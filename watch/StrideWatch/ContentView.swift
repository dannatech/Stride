import SwiftUI

struct ContentView: View {
    @EnvironmentObject var conn: ConnectivityManager

    var body: some View {
        Group {
            if conn.receivedFirstPayload && conn.authenticated {
                NavigationStack {
                    TabView {
                        SummaryView().tag(0)
                        LiveView().tag(1)
                        CoreView().tag(2)
                        PaceView().tag(3)
                        HistoryView().tag(4)
                        CoachView().tag(5)
                    }
                    .tabViewStyle(.page)
                }
            } else {
                ConnectionStatusView()
            }
        }
    }
}
