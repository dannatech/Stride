import SwiftUI

/// Shown until the phone has pushed a first payload with `authenticated: true`.
/// The watch never collects credentials itself — the phone is the source of
/// truth for auth, matching the WatchConnectivity-from-iPhone data flow.
struct ConnectionStatusView: View {
    @EnvironmentObject var conn: ConnectivityManager

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: conn.isReachable ? "iphone.gen3.radiowaves.left.and.right" : "iphone.slash")
                .font(.system(size: 26))
                .foregroundColor(conn.isReachable ? T.accent1 : T.sub)
            Text(conn.isReachable ? "Waiting for Stride…" : "iPhone Not Reachable")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(T.ink)
            Text("Open Stride on your iPhone and log in to sync your data here.")
                .font(.system(size: 10))
                .foregroundColor(T.sub)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(T.bg)
    }
}
