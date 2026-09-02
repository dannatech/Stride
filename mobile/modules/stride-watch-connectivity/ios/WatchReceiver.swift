import Foundation
import WatchConnectivity

/// Receives run telemetry pushed from the watchOS companion app (see
/// watch/StrideWatchApp/WorkoutManager.swift `send(_:)`) and forwards it to
/// the StrideWatchConnectivity Expo module, which relays it to JS as events.
final class WatchReceiver: NSObject, WCSessionDelegate {
    static let shared = WatchReceiver()

    var onPacket: (([String: Any]) -> Void)?
    var onSessionEvent: ((_ event: String, _ workoutType: String?) -> Void)?
    var onReachabilityChange: (() -> Void)?

    private(set) var lastPacket: [String: Any]?

    private override init() {
        super.init()
    }

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    var isPaired: Bool {
        WCSession.isSupported() && WCSession.default.isPaired
    }

    var isWatchAppInstalled: Bool {
        WCSession.isSupported() && WCSession.default.isWatchAppInstalled
    }

    var isReachable: Bool {
        WCSession.isSupported() && WCSession.default.isReachable
    }

    @discardableResult
    func sendSessionCommand(_ command: String) -> Bool {
        guard WCSession.isSupported(),
              ["pause", "resume", "stop"].contains(command) else { return false }

        let session = WCSession.default
        let payload: [String: Any] = [
            "phoneCommand": command,
            "commandID": UUID().uuidString,
            "commandSentAt": Date().timeIntervalSince1970,
        ]
        print("[StrideWatchConnectivity] sending phone command:", command,
              "reachable:", session.isReachable,
              "activationState:", session.activationState.rawValue)

        // Stop is safety-critical and idempotent. Send it immediately when
        // possible, but also queue it and preserve it as latest state. A
        // nominally reachable WCSession can still lose an unacknowledged
        // message while either app is transitioning screens.
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                print("[StrideWatchConnectivity] phone command send failed:", error.localizedDescription)
            }
        }
        if command == "stop" || !session.isReachable {
            session.transferUserInfo(payload)
            try? session.updateApplicationContext(payload)
        }
        return true
    }

    private func deliver(_ payload: [String: Any]) {
        DispatchQueue.main.async {
            // WorkoutManager sends two shapes over the same channel: a
            // "sessionEvent" (start/pause/resume/stop, sent immediately) and
            // regular RunPacket telemetry (sent on a throttled interval).
            if let event = payload["sessionEvent"] as? String {
                print("[StrideWatchConnectivity] received sessionEvent:", event, payload["workoutType"] ?? "-")
                self.onSessionEvent?(event, payload["workoutType"] as? String)
            } else {
                self.lastPacket = payload
                self.onPacket?(payload)
            }
        }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        print("[StrideWatchConnectivity] phone WCSession activation completed — state: \(activationState.rawValue), paired: \(session.isPaired), watchAppInstalled: \(session.isWatchAppInstalled), error: \(error?.localizedDescription ?? "none")")
        DispatchQueue.main.async { self.onReachabilityChange?() }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Immediately re-activate so a watch re-pair or app switch keeps working.
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.onReachabilityChange?() }
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.onReachabilityChange?() }
    }

    // The watch prefers `sendMessage` (see WorkoutManager.send), falling back to
    // `updateApplicationContext` when unreachable — handle both the same way.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        deliver(message)
    }

    // Queued session events arrive here when the counterpart is not reachable.
    // Unlike applicationContext, user-info transfers are not overwritten by
    // the next telemetry packet.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        deliver(userInfo)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        deliver(applicationContext)
    }
}
