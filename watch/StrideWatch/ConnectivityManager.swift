import Foundation
import WatchConnectivity
import Combine

/// Receives state pushed from the iPhone app (via WCSession) and republishes
/// it for SwiftUI. The phone is the source of truth — this app never writes
/// back workout data of its own, matching the "WatchConnectivity from
/// iPhone app" data flow decided for this build.
final class ConnectivityManager: NSObject, ObservableObject {
    static let shared = ConnectivityManager()

    @Published var isReachable = false
    @Published var authenticated = false
    @Published var receivedFirstPayload = false

    @Published var readiness = 72
    @Published var cycleDay = 9
    @Published var cycleLength = 28
    @Published var periodLength = 5
    @Published var sprintsToday = 8
    @Published var coreToday: [String: Int] = ["situps": 15, "twists": 10]
    @Published var session = LiveSession.placeholder
    @Published var ai = AIInsights.fallback

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    private func apply(_ payload: WatchPayload) {
        DispatchQueue.main.async {
            if let v = payload.authenticated { self.authenticated = v }
            if let v = payload.readiness { self.readiness = v }
            if let v = payload.cycleDay { self.cycleDay = v }
            if let v = payload.cycleLength { self.cycleLength = v }
            if let v = payload.periodLength { self.periodLength = v }
            if let v = payload.sprintsToday { self.sprintsToday = v }
            if let v = payload.coreToday { self.coreToday = v }
            if let v = payload.session { self.session = v }
            if let v = payload.ai { self.ai = v }
            self.receivedFirstPayload = true
        }
    }

    private func decode(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        guard let payload = try? JSONDecoder().decode(WatchPayload.self, from: data) else { return }
        apply(payload)
    }

    /// Sends a user action (Lap, log reps, log period, etc.) back to the
    /// phone, which owns the actual state and will push the updated
    /// snapshot back down via `didReceiveApplicationContext`.
    func sendAction(_ action: String, params: [String: Any] = [:]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        var message: [String: Any] = ["action": action]
        if !params.isEmpty { message["params"] = params }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: nil)
        } else {
            session.transferUserInfo(message)
        }
    }
}

extension ConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        decode(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        decode(message)
    }
}
