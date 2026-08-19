//
//  ContentView.swift
//  PostIt
//
//  Created by Manav Bokinala on 8/19/26.
//

import SwiftUI

struct ContentView: View {
    @State private var store = RequestStore()
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(store: store)
                .navigationTitle("PostIt")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            store.newRequest()
                        } label: {
                            Label("New Request", systemImage: "square.and.pencil")
                        }
                        .help("New Request (⌘N)")
                    }
                }
        } detail: {
            VSplitView {
                RequestEditorView(store: store)
                    .frame(minHeight: 300, idealHeight: 390)
                ResponseView(response: store.response)
                    .frame(minHeight: 240, idealHeight: 360)
            }
            .navigationTitle(store.draft.name)
        }
        .tint(.orange)
        .onReceive(NotificationCenter.default.publisher(for: .newPostItRequest)) { _ in
            store.newRequest()
        }
    }
}

#Preview {
    ContentView()
        .frame(width: 1280, height: 820)
}
