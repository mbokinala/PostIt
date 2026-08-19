import SwiftUI

struct SidebarView: View {
    @Bindable var store: RequestStore
    @State private var expandedCollections: Set<UUID> = []
    @State private var showNewCollection = false
    @State private var collectionName = ""
    @State private var renameTarget: RequestCollection?
    @State private var renamedCollection = ""

    var body: some View {
        List {
            Section {
                ForEach(store.collections) { collection in
                    DisclosureGroup(isExpanded: expansionBinding(for: collection.id)) {
                        if collection.requests.isEmpty {
                            Text("No saved requests")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .padding(.leading, 24)
                                .padding(.vertical, 5)
                        } else {
                            ForEach(collection.requests) { request in
                                requestRow(request)
                            }
                        }
                    } label: {
                        Label(collection.name, systemImage: "folder")
                            .fontWeight(.medium)
                            .contextMenu {
                                Button("Rename…") {
                                    renameTarget = collection
                                    renamedCollection = collection.name
                                }
                                Divider()
                                Button("Delete Collection", role: .destructive) {
                                    store.deleteCollection(id: collection.id)
                                }
                            }
                    }
                }
            } header: {
                HStack {
                    Text("Collections")
                    Spacer()
                    Button {
                        collectionName = ""
                        showNewCollection = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.plain)
                    .help("New Collection")
                }
                .padding(.trailing, 16)
            }

            Section {
                if store.history.isEmpty {
                    ContentUnavailableView {
                        Label("No History", systemImage: "clock")
                    } description: {
                        Text("Sent requests appear here.")
                    }
                    .frame(height: 110)
                } else {
                    ForEach(store.history.prefix(25)) { entry in
                        historyRow(entry)
                    }
                }
            } header: {
                HStack {
                    Text("History")
                    Spacer()
                    if !store.history.isEmpty {
                        Button {
                            store.clearHistory()
                        } label: {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.plain)
                        .help("Clear History")
                    }
                }
                .padding(.trailing, 16)
            }
        }
        .listStyle(.sidebar)
        .navigationSplitViewColumnWidth(min: 210, ideal: 250, max: 340)
        .onAppear {
            expandedCollections.formUnion(store.collections.map(\.id))
        }
        .sheet(isPresented: $showNewCollection) {
            NameSheet(
                title: "New Collection",
                prompt: "Collection Name",
                value: $collectionName,
                confirmTitle: "Create"
            ) {
                let name = collectionName.trimmingCharacters(in: .whitespacesAndNewlines)
                let id = store.addCollection(named: name.isEmpty ? "New Collection" : name)
                expandedCollections.insert(id)
            }
        }
        .sheet(item: $renameTarget) { collection in
            NameSheet(
                title: "Rename Collection",
                prompt: "Collection Name",
                value: $renamedCollection,
                confirmTitle: "Rename"
            ) {
                store.renameCollection(id: collection.id, name: renamedCollection)
            }
        }
    }

    private func requestRow(_ request: APIRequest) -> some View {
        Button {
            store.loadRequest(id: request.id)
        } label: {
            HStack(spacing: 7) {
                MethodBadge(method: request.method, compact: true)
                Text(request.name)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(SidebarRowButtonStyle(isSelected: store.selection == .request(request.id)))
        .contextMenu {
            Button("Open") { store.loadRequest(id: request.id) }
            Divider()
            Button("Delete", role: .destructive) { store.deleteRequest(id: request.id) }
        }
    }

    private func historyRow(_ entry: HistoryEntry) -> some View {
        Button {
            store.loadHistory(id: entry.id)
        } label: {
            HStack(spacing: 7) {
                MethodBadge(method: entry.request.method, compact: true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.request.name)
                        .lineLimit(1)
                    Text(entry.date.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Spacer(minLength: 2)
                if let status = entry.statusCode {
                    Text("\(status)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle((200..<300).contains(status) ? .green : .orange)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(SidebarRowButtonStyle(isSelected: store.selection == .history(entry.id)))
    }

    private func expansionBinding(for id: UUID) -> Binding<Bool> {
        Binding(
            get: { expandedCollections.contains(id) },
            set: { isExpanded in
                if isExpanded { expandedCollections.insert(id) }
                else { expandedCollections.remove(id) }
            }
        )
    }
}

private struct SidebarRowButtonStyle: ButtonStyle {
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.primary)
            .padding(.horizontal, 7)
            .padding(.vertical, 5)
            .background(
                isSelected ? Color.accentColor.opacity(0.18) : Color.clear,
                in: RoundedRectangle(cornerRadius: 6, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct NameSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let prompt: String
    @Binding var value: String
    let confirmTitle: String
    let onConfirm: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(title)
                .font(.title2.weight(.semibold))
            TextField(prompt, text: $value)
                .textFieldStyle(.roundedBorder)
                .onSubmit(confirm)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(confirmTitle, action: confirm)
                    .keyboardShortcut(.defaultAction)
                    .disabled(value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(24)
        .frame(width: 360)
    }

    private func confirm() {
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        onConfirm()
        dismiss()
    }
}
