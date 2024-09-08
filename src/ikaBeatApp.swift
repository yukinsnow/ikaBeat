import SwiftUI

@main
struct FindBPMApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(width: 400)
                .fixedSize(horizontal: true, vertical: false)
        }
        .windowStyle(.titleBar)
        .windowResizability(.contentSize)
    }
}
