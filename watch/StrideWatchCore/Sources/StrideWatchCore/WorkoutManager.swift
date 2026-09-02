import Foundation
import Combine
import CoreLocation
import HealthKit
import WatchConnectivity

// Mirrors the phone's WORKOUT_TYPES (mobile/src/data.js) — HealthKit has no
// distinct "sprint" activity type, so sprint maps to .running same as run.
public enum WatchWorkoutType: String {
    case run
    case walk
    case sprint

    var hkActivityType: HKWorkoutActivityType {
        self == .walk ? .walking : .running
    }
}

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
    // Only call finishRoute if at least one location was actually inserted —
    // calling it with zero route data is what triggers the "no data was added
    // to the workout route" failure (an app-level error before, but this also
    // avoids whatever the OS itself does with that failure internally).
    private var hasRouteData = false

    private var startDate: Date?
    private var elapsedTimer: Timer?
    private var lastSendDate: Date = .distantPast
    private let sendInterval: TimeInterval = 2
    private var currentType: WatchWorkoutType = .run

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

    public func start(type: WatchWorkoutType = .run) {
        requestAuthorization()
        currentType = type

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = type.hkActivityType
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
            hasRouteData = false
            isRunning = true
            isPaused = false

            locationManager.requestWhenInUseAuthorization()
            locationManager.startUpdatingLocation()
            startElapsedTimer()
            sendSessionEvent("start", workoutType: type)
        } catch {
            authorizationError = error.localizedDescription
        }
    }

    public func pause() {
        isPaused = true
        locationManager.stopUpdatingLocation()
        elapsedTimer?.invalidate()
        sendSessionEvent("pause")
    }

    public func resume() {
        isPaused = false
        locationManager.startUpdatingLocation()
        startElapsedTimer()
        sendSessionEvent("resume")
    }

    public func stop() {
        isRunning = false
        isPaused = false
        elapsedTimer?.invalidate()
        locationManager.stopUpdatingLocation()
        sendSessionEvent("stop")

        guard let session = workoutSession, let builder = liveBuilder else { return }
        // Capture before clearing below; only actually finish the route if we
        // ever inserted a location into it — finishing an empty route is what
        // produces the "no data was added to the workout route" failure.
        let routeBuilderToFinish = hasRouteData ? routeBuilder : nil

        session.end()
        builder.endCollection(withEnd: Date()) { _, _ in
            builder.finishWorkout { workout, _ in
                guard let workout, let routeBuilderToFinish else { return }
                routeBuilderToFinish.finishRoute(with: workout, metadata: nil) { _, _ in }
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

    // Sent immediately (not throttled like telemetry) so the phone can mirror
    // Start/Pause/Resume/Stop as soon as they happen on the watch.
    private func sendSessionEvent(_ event: String, workoutType: WatchWorkoutType? = nil) {
        guard WCSession.isSupported() else {
            print("[Stride] sendSessionEvent(\(event)): WCSession not supported")
            return
        }
        let session = WCSession.default
        var payload: [String: Any] = ["sessionEvent": event]
        if let workoutType { payload["workoutType"] = workoutType.rawValue }
        print("[Stride] sendSessionEvent(\(event)) — reachable: \(session.isReachable), activationState: \(session.activationState.rawValue)")
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                print("[Stride] sendMessage failed, falling back to context:", error.localizedDescription)
                try? session.updateApplicationContext(payload)
            }
        } else {
            try? session.updateApplicationContext(payload)
        }
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
            self.routeBuilder?.insertRouteData([location]) { [weak self] success, _ in
                guard success else { return }
                Task { @MainActor in self?.hasRouteData = true }
            }
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
    nonisolated public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        print("[Stride] WCSession activation completed — state: \(activationState.rawValue), error: \(error?.localizedDescription ?? "none")")
    }
}
