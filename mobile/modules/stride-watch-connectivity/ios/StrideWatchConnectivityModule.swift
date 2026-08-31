import ExpoModulesCore
import WatchConnectivity

public class StrideWatchConnectivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("StrideWatchConnectivity")

        Events("onRunPacket", "onReachabilityChange")

        OnCreate {
            WatchReceiver.shared.start()
        }

        Function("isSupported") { () -> Bool in
            WCSession.isSupported()
        }

        Function("isPaired") { () -> Bool in
            WatchReceiver.shared.isPaired
        }

        Function("isWatchAppInstalled") { () -> Bool in
            WatchReceiver.shared.isWatchAppInstalled
        }

        Function("isReachable") { () -> Bool in
            WatchReceiver.shared.isReachable
        }

        Function("getLastPacket") { () -> [String: Any]? in
            WatchReceiver.shared.lastPacket
        }

        OnStartObserving {
            WatchReceiver.shared.onPacket = { [weak self] payload in
                self?.sendEvent("onRunPacket", payload)
            }
            WatchReceiver.shared.onReachabilityChange = { [weak self] in
                self?.sendEvent("onReachabilityChange", [
                    "isPaired": WatchReceiver.shared.isPaired,
                    "isWatchAppInstalled": WatchReceiver.shared.isWatchAppInstalled,
                    "isReachable": WatchReceiver.shared.isReachable,
                ])
            }
        }

        OnStopObserving {
            WatchReceiver.shared.onPacket = nil
            WatchReceiver.shared.onReachabilityChange = nil
        }
    }
}
