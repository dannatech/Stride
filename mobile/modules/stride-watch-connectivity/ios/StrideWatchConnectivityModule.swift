import ExpoModulesCore
import WatchConnectivity

public class StrideWatchConnectivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("StrideWatchConnectivity")

        Events("onWatchAction")

        OnCreate {
            WatchBridge.shared.start()
        }

        Function("isSupported") { () -> Bool in
            WCSession.isSupported()
        }

        Function("isPaired") { () -> Bool in
            WatchBridge.shared.isPaired
        }

        Function("sendUpdate") { (payload: [String: Any]) in
            WatchBridge.shared.send(payload)
        }

        OnStartObserving {
            WatchBridge.shared.onAction = { [weak self] action, params in
                self?.sendEvent("onWatchAction", ["action": action, "params": params ?? [:]])
            }
        }

        OnStopObserving {
            WatchBridge.shared.onAction = nil
        }
    }
}
