import Foundation
import Combine
import CoreLocation
import HealthKit
import WatchConnectivity

@MainActor
public final class WorkoutManager: NSObject, ObservableObject, @unchecked Sendable {
    @Published public var isRunning = false
    @Published public var isPaused = false
    @Published public var elapsedSeconds: TimeInterval = 0
    @Published public var distanceMiles: Double = 0
    @Published public var currentPace: Double = 0
    @Published public var heartRate: Double = 0
    @Published public var groundContactTime: Double = 0
    @Published public var verticalOscillation: Double = 0
    @Published public var strideLength: Double = 0
    @Published public var power: Double = 0
    @Published public var authorizationError: String?
    @Published public var locationAuthorizationStatus: CLAuthorizationStatus = .notDetermined

    private let healthStore = HKHealthStore()
    private let locationManager = CLLocationManager()
    private let paceCalculator = PaceCalculator()

    private let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
    private let groundContactTimeType = HKQuantityType.quantityType(forIdentifier: .runningGroundContactTime)!
    private let verticalOscillationType = HKQuantityType.quantityType(forIdentifier: .runningVerticalOscillation)!
    private let strideLengthType = HKQuantityType.quantityType(forIdentifier: .runningStrideLength)!
    private let runningPowerType = HKQuantityType.quantityType(forIdentifier: .runningPower)!

    private var workoutSession: HKWorkoutSession?
    private var liveBuilder: HKLiveWorkoutBuilder?
    private var routeBuilder: HKWorkoutRouteBuilder?
    private var lastCoordinate: CLLocationCoordinate2D?

    private var startDate: Date?
    private var elapsedTimer: Timer?
    private var lastSendDate: Date = .distantPast
    private let sendInterval: TimeInterval = 2

    public override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3
        locationManager.activityType = .fitness
        locationAuthorizationStatus = locationManager.authorizationStatus

        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func requestAuthorization() {
        let typesToShare: Set = [HKQuantityType.workoutType()]
        let typesToRead: Set<HKObjectType> = [
            heartRateType, groundContactTimeType, verticalOscillationType, strideLengthType, runningPowerType,
        ]
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] _, error in
            guard let error else { return }
            Task { @MainActor in self?.authorizationError = error.localizedDescription }
        }
    }

    public func start() {
        requestAuthorization()

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .running
        configuration.locationType = .outdoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            session.delegate = self
            builder.delegate = self

            workoutSession = session
            liveBuilder = builder
            routeBuilder = HKWorkoutRouteBuilder(healthStore: healthStore, device: nil)

            let now = Date()
            session.startActivity(with: now)
            builder.beginCollection(withStart: now) { [weak self] _, error in
                guard let error else { return }
                Task { @MainActor in self?.authorizationError = error.localizedDescription }
            }

            startDate = now
            paceCalculator.reset()
            distanceMiles = 0
            currentPace = 0
            isRunning = true
            isPaused = false

            locationManager.requestWhenInUseAuthorization()
            locationManager.startUpdatingLocation()
            startElapsedTimer()
        } catch {
            authorizationError = error.localizedDescription
        }
    }

    public func pause() {
        isPaused = true
        locationManager.stopUpdatingLocation()
        elapsedTimer?.invalidate()
    }

    public func resume() {
        isPaused = false
        locationManager.startUpdatingLocation()
        startElapsedTimer()
    }

    public func stop() {
        isRunning = false
        isPaused = false
        elapsedTimer?.invalidate()
        locationManager.stopUpdatingLocation()

        guard let session = workoutSession, let builder = liveBuilder else { return }
        let routeBuilderToFinish = routeBuilder // capture before clearing below

        session.end()
        builder.endCollection(withEnd: Date()) { [weak self] _, _ in
            builder.finishWorkout { workout, _ in
                guard let workout else { return }
                routeBuilderToFinish?.finishRoute(with: workout, metadata: nil) { _, _ in
                    // Intentionally not surfaced to authorizationError: this fails
                    // benignly whenever the run ends before a GPS fix ever arrived
                    // (e.g. a short test, or starting indoors) — the workout itself
                    // still saves to Health either way, just without a route.
                }
            }
        }

        workoutSession = nil
        liveBuilder = nil
        routeBuilder = nil
    }

    private func startElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let startDate = self.startDate, self.isRunning, !self.isPaused else { return }
                self.elapsedSeconds = Date().timeIntervalSince(startDate)
                self.currentPace = self.paceCalculator.currentPace
                self.distanceMiles = self.paceCalculator.distanceMiles
                self.sendIfDue()
            }
        }
    }

    private func sendIfDue() {
        guard Date().timeIntervalSince(lastSendDate) >= sendInterval else { return }
        lastSendDate = Date()
        send(RunPacket(
            pace: currentPace,
            lat: lastCoordinate?.latitude ?? 0,
            lon: lastCoordinate?.longitude ?? 0,
            heartRate: heartRate,
            groundContactTime: groundContactTime,
            verticalOscillation: verticalOscillation,
            strideLength: strideLength,
            power: power,
            elapsedSeconds: elapsedSeconds
        ))
    }

    private func send(_ packet: RunPacket) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        let payload = packet.asDictionary
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in
                try? session.updateApplicationContext(payload)
            }
        } else {
            try? session.updateApplicationContext(payload)
        }
    }
}

extension WorkoutManager: CLLocationManagerDelegate {
    nonisolated public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            self.lastCoordinate = location.coordinate
            self.paceCalculator.ingest(location)
            self.routeBuilder?.insertRouteData([location]) { _, _ in }
        }
    }

    nonisolated public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.authorizationError = error.localizedDescription }
    }

    nonisolated public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.locationAuthorizationStatus = status }
    }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated public func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    nonisolated public func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in self.authorizationError = error.localizedDescription }
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated public func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let statistics = workoutBuilder.statistics(for: quantityType) else { continue }
            Task { @MainActor in
                switch quantityType {
                case self.heartRateType:
                    let unit = HKUnit.count().unitDivided(by: .minute())
                    self.heartRate = statistics.mostRecentQuantity()?.doubleValue(for: unit) ?? self.heartRate
                case self.groundContactTimeType:
                    self.groundContactTime = statistics.mostRecentQuantity()?.doubleValue(for: .secondUnit(with: .milli)) ?? self.groundContactTime
                case self.verticalOscillationType:
                    self.verticalOscillation = statistics.mostRecentQuantity()?.doubleValue(for: .meterUnit(with: .centi)) ?? self.verticalOscillation
                case self.strideLengthType:
                    self.strideLength = statistics.mostRecentQuantity()?.doubleValue(for: .meter()) ?? self.strideLength
                case self.runningPowerType:
                    self.power = statistics.mostRecentQuantity()?.doubleValue(for: .watt()) ?? self.power
                default:
                    break
                }
            }
        }
    }

    nonisolated public func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}

extension WorkoutManager: WCSessionDelegate {
    nonisolated public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}
