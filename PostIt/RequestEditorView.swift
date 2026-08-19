import SwiftUI

struct RequestEditorView: View {
    @Bindable var store: RequestStore
    @State private var selectedTab: RequestEditorTab = .parameters
    @State private var showCurlImporter = false
    @State private var showSaveSheet = false
    @State private var saveName = ""
    @State private var saveCollectionID: UUID?

    var body: some View {
        VStack(spacing: 0) {
            requestTitleBar
            Divider()
            requestBar
            tabBar
            Divider()
            tabContent
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .sheet(isPresented: $showCurlImporter) {
            CurlImportSheet { request in
                store.draft = request
                store.response = nil
                store.selection = nil
            }
        }
        .sheet(isPresented: $showSaveSheet) {
            SaveRequestSheet(
                name: $saveName,
                collectionID: $saveCollectionID,
                collections: store.collections
            ) {
                guard let collectionID = saveCollectionID else { return }
                store.saveDraft(in: collectionID, name: saveName)
            }
        }
        .alert("Request Failed", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Unknown error")
        }
    }

    private var requestTitleBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.text")
                .foregroundStyle(.secondary)
            Text(store.draft.name)
                .font(.headline)
                .lineLimit(1)
            Spacer()

            Menu {
                Button("Import from cURL…", systemImage: "square.and.arrow.down") {
                    showCurlImporter = true
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])
                Button("Copy as cURL", systemImage: "doc.on.doc") {
                    Clipboard.copy(CurlCodec.encode(store.draft))
                }
                .keyboardShortcut("c", modifiers: [.command, .shift])
            } label: {
                Label("cURL", systemImage: "terminal")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()

            Button {
                saveName = store.draft.name
                saveCollectionID = store.collections.first?.id
                showSaveSheet = true
            } label: {
                Label("Save", systemImage: "tray.and.arrow.down")
            }
            .disabled(store.collections.isEmpty)
        }
        .padding(.horizontal, 14)
        .frame(height: 45)
    }

    private var requestBar: some View {
        HStack(spacing: 10) {
            Picker("Method", selection: $store.draft.method) {
                ForEach(HTTPMethod.allCases) { method in
                    Text(method.rawValue).tag(method)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(width: 104)
            .tint(store.draft.method.color)

            HStack(spacing: 7) {
                Image(systemName: "globe")
                    .foregroundStyle(.tertiary)
                TextField("https://api.example.com/resource", text: $store.draft.url)
                    .textFieldStyle(.plain)
                    .font(.body.monospaced())
                    .onSubmit { Task { await store.send() } }
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(Color(nsColor: .textBackgroundColor))
            .postItCard()

            Button {
                Task { await store.send() }
            } label: {
                HStack(spacing: 7) {
                    if store.isSending {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text(store.isSending ? "Sending" : "Send")
                }
                .frame(minWidth: 68)
            }
            .buttonStyle(.borderedProminent)
            .keyboardShortcut(.return, modifiers: [.command])
            .disabled(store.draft.url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isSending)
            .help("Send Request (⌘↩)")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private var tabBar: some View {
        HStack {
            Picker("Request Options", selection: $selectedTab) {
                ForEach(RequestEditorTab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .labelsHidden()
            .pickerStyle(.segmented)
            .frame(maxWidth: 520)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .parameters:
            KeyValueEditor(items: $store.draft.queryItems, keyTitle: "Parameter", valueTitle: "Value")
        case .headers:
            KeyValueEditor(items: $store.draft.headers, keyTitle: "Header", valueTitle: "Value")
        case .cookies:
            KeyValueEditor(items: $store.draft.cookies, keyTitle: "Cookie", valueTitle: "Value")
        case .body:
            BodyEditor(request: $store.draft)
        }
    }
}

private struct BodyEditor: View {
    @Binding var request: APIRequest

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("Body Type", selection: $request.bodyKind) {
                    ForEach(RequestBodyKind.allCases) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 150)
                Spacer()
                if request.bodyKind == .json && !request.rawBody.isEmpty {
                    Button("Format JSON", systemImage: "text.alignleft") {
                        formatJSON()
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 38)

            Divider()

            switch request.bodyKind {
            case .none:
                ContentUnavailableView(
                    "No Request Body",
                    systemImage: "doc",
                    description: Text("Choose a body type from the menu above.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .json, .text:
                TextEditor(text: $request.rawBody)
                    .font(.system(.body, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Color(nsColor: .textBackgroundColor))
            case .formData:
                KeyValueEditor(items: $request.formData, keyTitle: "Field", valueTitle: "Value")
            case .urlEncoded:
                KeyValueEditor(items: $request.urlEncodedData, keyTitle: "Field", valueTitle: "Value")
            }
        }
    }

    private func formatJSON() {
        guard let data = request.rawBody.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              let formatted = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
              let string = String(data: formatted, encoding: .utf8) else { return }
        request.rawBody = string
    }
}

private struct CurlImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var command = ""
    @State private var errorMessage: String?
    let onImport: (APIRequest) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "terminal")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Import cURL")
                        .font(.title2.weight(.semibold))
                    Text("Paste a command copied from your terminal or browser.")
                        .foregroundStyle(.secondary)
                }
            }
            TextEditor(text: $command)
                .font(.system(.body, design: .monospaced))
                .padding(6)
                .frame(minHeight: 190)
                .background(Color(nsColor: .textBackgroundColor))
                .postItCard()

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.callout)
                    .foregroundStyle(.red)
            }

            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Import") {
                    do {
                        onImport(try CurlCodec.decode(command))
                        dismiss()
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(24)
        .frame(width: 580, height: 340)
    }
}

private struct SaveRequestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var name: String
    @Binding var collectionID: UUID?
    let collections: [RequestCollection]
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Save Request")
                .font(.title2.weight(.semibold))
            Form {
                TextField("Name", text: $name)
                Picker("Collection", selection: $collectionID) {
                    ForEach(collections) { collection in
                        Text(collection.name).tag(Optional(collection.id))
                    }
                }
            }
            .formStyle(.grouped)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Save") {
                    onSave()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || collectionID == nil)
            }
        }
        .padding(24)
        .frame(width: 420)
    }
}
