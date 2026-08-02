import SwiftUI

@main
struct StrideWatchApp: App {
    @StateObject private var connectivity = ConnectivityManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectivity)
        }
    }
}
