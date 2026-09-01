import CoreLocation

/// Direct port of the phone's usePaceTracker.ts pace math — same haversine
/// distance, same 15s rolling window, same accuracy/jump guards — so pace
/// behaves identically whether it's computed on the watch or the phone.
public final class PaceCalculator {
    private struct Sample { let t: TimeInterval; let cumDistMiles: Double }

    private let rollingWindowSeconds: TimeInterval = 15
    private let minAccuracyMeters: Double = 30
    private let maxPlausibleSegmentMiles: Double = 0.5

    public private(set) var distanceMiles: Double = 0
    public private(set) var currentPace: Double = 0 // seconds per mile

    private var lastLocation: CLLocation?
    private var samples: [Sample] = []

    public init() {}

    public func reset() {
        distanceMiles = 0
        currentPace = 0
        lastLocation = nil
        samples = []
    }

    public func ingest(_ location: CLLocation) {
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= minAccuracyMeters else { return }
        defer { lastLocation = location }
        guard let prev = lastLocation else { return }

        let segmentMiles = location.distance(from: prev) / 1609.344
        guard segmentMiles <= maxPlausibleSegmentMiles else { return }

        distanceMiles += segmentMiles

        let t = location.timestamp.timeIntervalSince1970
        samples.append(Sample(t: t, cumDistMiles: distanceMiles))
        let cutoff = t - rollingWindowSeconds
        samples.removeAll { $0.t < cutoff }

        guard samples.count >= 2, let first = samples.first, let last = samples.last else { return }
        let dtSec = last.t - first.t
        let ddMiles = last.cumDistMiles - first.cumDistMiles
        guard dtSec > 0, ddMiles > 0.0005 else { return }
        currentPace = dtSec / ddMiles
    }
}
