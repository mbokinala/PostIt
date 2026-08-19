//
//  PostItApp.swift
//  PostIt
//
//  Created by Manav Bokinala on 8/19/26.
//

import SwiftUI

@main
struct PostItApp: App {
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
        }
    }
}

extension Notification.Name {
    static let newPostItRequest = Notification.Name("newPostItRequest")
}
