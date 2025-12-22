import SwiftUI
import ComposeApp

@main
struct iOSApp: App {
    init() {
        KoinHelperKt.initKoinIos()
    }
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}