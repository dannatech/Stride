import Foundation
import WatchConnectivity

/// Owns the phone-side WCSession and is the single source of truth the
/// Expo module talks to. Kept separate from the module class because
/// WCSessionDelegate must be an NSObject, and the delegate needs to stay
/// alive independent of the JS bridge's module lifecycle.
final class WatchBridge: NSObject {
    static let shared = WatchBridge()

    /// Called with (action, params) whenever the watch sends a user action
    /// (Lap, log reps, etc.) back to the phone.
    var onAction: ((String, [String: Any]?) -> Void)?

    private var session: WCSession? {
        WCSession.isSupported() ? WCSession.default : nil
    }

    func start() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    func send(_ payload: [String: Any]) {
        guard let session, session.activationState == .activated else { return }
        do {
            try session.updateApplicationContext(payload)
        } catch {
            // Best-effort: applicationContext delivery isn't guaranteed to
            // succeed synchronously if the watch app was just terminated.
        }
    }

    var isPaired: Bool {
        session?.isPaired ?? false
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleIncoming(userInfo)
    }

    private func handleIncoming(_ message: [String: Any]) {
        guard let action = message["action"] as? String else { return }
        let params = message["params"] as? [String: Any]
        DispatchQueue.main.async {
            self.onAction?(action, params)
        }
    }
}
