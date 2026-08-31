import Foundation
import WatchConnectivity

/// Receives run telemetry pushed from the watchOS companion app (see
/// watch/StrideWatchApp/WorkoutManager.swift `send(_:)`) and forwards it to
/// the StrideWatchConnectivity Expo module, which relays it to JS as events.
final class WatchReceiver: NSObject, WCSessionDelegate {
    static let shared = WatchReceiver()

    var onPacket: (([String: Any]) -> Void)?
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

    private func deliver(_ payload: [String: Any]) {
        DispatchQueue.main.async {
            self.lastPacket = payload
            self.onPacket?(payload)
        }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
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

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        deliver(applicationContext)
    }
}
