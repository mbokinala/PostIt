import Foundation
import SwiftUI

enum HTTPMethod: String, CaseIterable, Codable, Identifiable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
    case head = "HEAD"
    case options = "OPTIONS"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .get: .green
        case .post: .orange
        case .put: .blue
        case .patch: .purple
        case .delete: .red
        case .head, .options: .secondary
        }
    }
}

struct KeyValueItem: Identifiable, Codable, Equatable {
    var id = UUID()
    var isEnabled = true
    var key = ""
    var value = ""

    init(id: UUID = UUID(), isEnabled: Bool = true, key: String = "", value: String = "") {
        self.id = id
        self.isEnabled = isEnabled
        self.key = key
        self.value = value
    }
}

enum RequestBodyKind: String, CaseIterable, Codable, Identifiable {
    case none = "None"
    case json = "JSON"
    case text = "Text"
    case formData = "Form Data"
    case urlEncoded = "URL Encoded"

    var id: String { rawValue }
}

struct APIRequest: Identifiable, Codable, Equatable {
    var id = UUID()
    var name = "Untitled Request"
    var method: HTTPMethod = .get
    var url = ""
    var queryItems: [KeyValueItem] = [KeyValueItem()]
    var headers: [KeyValueItem] = [KeyValueItem()]
    var cookies: [KeyValueItem] = [KeyValueItem()]
    var bodyKind: RequestBodyKind = .none
    var rawBody = ""
    var formData: [KeyValueItem] = [KeyValueItem()]
    var urlEncodedData: [KeyValueItem] = [KeyValueItem()]
    var updatedAt = Date()
}

struct RequestCollection: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
    var requests: [APIRequest] = []
}

struct HistoryEntry: Identifiable, Codable, Equatable {
    var id = UUID()
    var date = Date()
    var request: APIRequest
    var statusCode: Int?
    var durationMilliseconds: Double?
}

struct APIResponse: Equatable {
    let statusCode: Int
    let reason: String
    let durationMilliseconds: Double
    let data: Data
    let headers: [(name: String, value: String)]
    let requestURL: URL
    let rawRequest: String
    let rawResponse: String

    static func == (lhs: APIResponse, rhs: APIResponse) -> Bool {
        lhs.statusCode == rhs.statusCode &&
        lhs.durationMilliseconds == rhs.durationMilliseconds &&
        lhs.data == rhs.data &&
        lhs.requestURL == rhs.requestURL
    }

    var bodyText: String {
        String(data: data, encoding: .utf8) ?? "<\(data.count) bytes of binary data>"
    }

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)
    }

    var isSuccess: Bool { (200..<300).contains(statusCode) }
}

enum SidebarSelection: Hashable {
    case request(UUID)
    case history(UUID)
}

enum RequestEditorTab: String, CaseIterable, Identifiable {
    case parameters = "Parameters"
    case headers = "Headers"
    case body = "Body"
    case cookies = "Cookies"

    var id: String { rawValue }
}

enum ResponseViewerTab: String, CaseIterable, Identifiable {
    case body = "Body"
    case headers = "Headers"
    case console = "Console"

    var id: String { rawValue }
}
