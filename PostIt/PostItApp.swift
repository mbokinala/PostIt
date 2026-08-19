//
//  PostItApp.swift
//  PostIt
//
//  Created by Manav Bokinala on 8/19/26.
//

import Sparkle
import SwiftUI

@main
struct PostItApp: App {
    private let updaterController = SPUStandardUpdaterController(
        startingUpdater: true,
        updaterDelegate: nil,
        userDriverDelegate: nil
    )

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 1280, height: 820)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Request") {
                    NotificationCenter.default.post(name: .newPostItRequest, object: nil)
                }
                .keyboardShortcut("n", modifiers: .command)
            }
            CommandGroup(after: .appInfo) {
                Button("Check for Updates…") {
                    updaterController.checkForUpdates(nil)
                }
            }
        }
    }
}

extension Notification.Name {
    static let newPostItRequest = Notification.Name("newPostItRequest")
}
