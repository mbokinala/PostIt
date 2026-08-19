import Foundation
import Observation

@MainActor
@Observable
final class RequestStore {
    var collections: [RequestCollection]
    var history: [HistoryEntry]
    var draft: APIRequest
    var response: APIResponse?
    var isSending = false
    var errorMessage: String?
    var selection: SidebarSelection?

    private let defaults: UserDefaults
    private static let collectionsKey = "postit.collections.v1"
    private static let historyKey = "postit.history.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        let loadedCollections: [RequestCollection]
        if let data = defaults.data(forKey: Self.collectionsKey),
           let decoded = try? JSONDecoder().decode([RequestCollection].self, from: data) {
            loadedCollections = decoded
        } else {
            loadedCollections = Self.starterCollections
        }

        let loadedHistory: [HistoryEntry]
        if let data = defaults.data(forKey: Self.historyKey),
           let decoded = try? JSONDecoder().decode([HistoryEntry].self, from: data) {
            loadedHistory = decoded
        } else {
            loadedHistory = []
        }

        let initialRequest = loadedCollections.first?.requests.first ?? Self.starterRequest
        collections = loadedCollections
        history = loadedHistory
        draft = initialRequest
        selection = loadedCollections.first?.requests.first.map { .request($0.id) }
    }

    func newRequest() {
        draft = APIRequest()
        response = nil
        selection = nil
    }

    func loadRequest(id: UUID) {
        guard let request = collections.lazy.flatMap(\.requests).first(where: { $0.id == id }) else { return }
        draft = request
        response = nil
        selection = .request(id)
    }

    func loadHistory(id: UUID) {
        guard let entry = history.first(where: { $0.id == id }) else { return }
        draft = entry.request
        draft.id = UUID()
        draft.name = "\(entry.request.name) Copy"
        response = nil
        selection = .history(id)
    }

    @discardableResult
    func addCollection(named name: String) -> UUID {
        let collection = RequestCollection(name: name)
        collections.append(collection)
        persistCollections()
        return collection.id
    }

    func deleteCollection(id: UUID) {
        collections.removeAll { $0.id == id }
        if case let .request(requestID) = selection,
           !collections.contains(where: { $0.requests.contains(where: { $0.id == requestID }) }) {
            newRequest()
        }
        persistCollections()
    }

    func renameCollection(id: UUID, name: String) {
        guard let index = collections.firstIndex(where: { $0.id == id }) else { return }
        collections[index].name = name
        persistCollections()
    }

    func saveDraft(in collectionID: UUID, name: String) {
        draft.name = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Request" : name
        draft.updatedAt = Date()

        for collectionIndex in collections.indices {
            if let requestIndex = collections[collectionIndex].requests.firstIndex(where: { $0.id == draft.id }) {
                collections[collectionIndex].requests[requestIndex] = draft
                selection = .request(draft.id)
                persistCollections()
                return
            }
        }

        guard let collectionIndex = collections.firstIndex(where: { $0.id == collectionID }) else { return }
        collections[collectionIndex].requests.append(draft)
        selection = .request(draft.id)
        persistCollections()
    }

    func deleteRequest(id: UUID) {
        for index in collections.indices {
            collections[index].requests.removeAll { $0.id == id }
        }
        if selection == .request(id) { newRequest() }
        persistCollections()
    }

    func clearHistory() {
        history.removeAll()
        if case .history = selection { selection = nil }
        persistHistory()
    }

    func send() async {
        guard !isSending else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }

        do {
            let result = try await NetworkService.send(draft)
            response = result
            history.insert(HistoryEntry(
                request: draft,
                statusCode: result.statusCode,
                durationMilliseconds: result.durationMilliseconds
            ), at: 0)
            if history.count > 100 { history.removeLast(history.count - 100) }
            persistHistory()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func persistCollections() {
        guard let data = try? JSONEncoder().encode(collections) else { return }
        defaults.set(data, forKey: Self.collectionsKey)
    }

    private func persistHistory() {
        guard let data = try? JSONEncoder().encode(history) else { return }
        defaults.set(data, forKey: Self.historyKey)
    }

    private static let starterRequest: APIRequest = {
        var request = APIRequest()
        request.name = "Swift Repository"
        request.url = "https://api.github.com/repos/swiftlang/swift"
        request.headers = [
            KeyValueItem(key: "Accept", value: "application/vnd.github+json")
        ]
        return request
    }()

    private static let starterCollections = [
        RequestCollection(name: "Getting Started", requests: [starterRequest])
    ]
}
