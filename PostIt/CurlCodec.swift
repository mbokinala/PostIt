import Foundation

enum CurlParseError: LocalizedError {
    case empty
    case missingURL

    var errorDescription: String? {
        switch self {
        case .empty: "Paste a cURL command to import."
        case .missingURL: "The cURL command does not contain a URL."
        }
    }
}

enum CurlCodec {
    static func encode(_ apiRequest: APIRequest) -> String {
        var parts = ["curl", "-X", apiRequest.method.rawValue]

        for header in apiRequest.headers where header.isEnabled && !header.key.isEmpty {
            parts.append(contentsOf: ["-H", shellQuote("\(header.key): \(header.value)")])
        }

        let cookies = apiRequest.cookies.filter { $0.isEnabled && !$0.key.isEmpty }
        if !cookies.isEmpty {
            parts.append(contentsOf: ["-b", shellQuote(cookies.map { "\($0.key)=\($0.value)" }.joined(separator: "; "))])
        }

        switch apiRequest.bodyKind {
        case .none:
            break
        case .json:
            if !hasContentType(in: apiRequest.headers) {
                parts.append(contentsOf: ["-H", shellQuote("Content-Type: application/json")])
            }
            parts.append(contentsOf: ["--data-raw", shellQuote(apiRequest.rawBody)])
        case .text:
            if !hasContentType(in: apiRequest.headers) {
                parts.append(contentsOf: ["-H", shellQuote("Content-Type: text/plain")])
            }
            parts.append(contentsOf: ["--data-raw", shellQuote(apiRequest.rawBody)])
        case .urlEncoded:
            for item in apiRequest.urlEncodedData where item.isEnabled && !item.key.isEmpty {
                parts.append(contentsOf: ["--data-urlencode", shellQuote("\(item.key)=\(item.value)")])
            }
        case .formData:
            for item in apiRequest.formData where item.isEnabled && !item.key.isEmpty {
                parts.append(contentsOf: ["-F", shellQuote("\(item.key)=\(item.value)")])
            }
        }

        let url = (try? NetworkService.resolvedURL(for: apiRequest))?.absoluteString ?? apiRequest.url
        parts.append(shellQuote(url))
        return parts.joined(separator: " ")
    }

    static func decode(_ command: String) throws -> APIRequest {
        let tokens = tokenize(command)
        guard !tokens.isEmpty else { throw CurlParseError.empty }

        var request = APIRequest()
        var headers: [KeyValueItem] = []
        var formData: [KeyValueItem] = []
        var encodedData: [KeyValueItem] = []
        var body: String?
        var urlString: String?
        var index = tokens.first?.lowercased() == "curl" ? 1 : 0

        while index < tokens.count {
            let token = tokens[index]
            switch token {
            case "-X", "--request":
                index += 1
                if index < tokens.count, let method = HTTPMethod(rawValue: tokens[index].uppercased()) {
                    request.method = method
                }
            case "-H", "--header":
                index += 1
                if index < tokens.count {
                    let pieces = tokens[index].split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                    if pieces.count == 2 {
                        headers.append(KeyValueItem(
                            key: String(pieces[0]).trimmingCharacters(in: .whitespaces),
                            value: String(pieces[1]).trimmingCharacters(in: .whitespaces)
                        ))
                    }
                }
            case "-b", "--cookie":
                index += 1
                if index < tokens.count {
                    request.cookies = tokens[index].split(separator: ";").compactMap { pair in
                        let pieces = pair.split(separator: "=", maxSplits: 1)
                        guard pieces.count == 2 else { return nil }
                        return KeyValueItem(
                            key: String(pieces[0]).trimmingCharacters(in: .whitespaces),
                            value: String(pieces[1]).trimmingCharacters(in: .whitespaces)
                        )
                    }
                }
            case "-d", "--data", "--data-raw", "--data-binary":
                index += 1
                if index < tokens.count { body = tokens[index] }
            case "--data-urlencode":
                index += 1
                if index < tokens.count {
                    encodedData.append(keyValue(from: tokens[index]))
                }
            case "-F", "--form":
                index += 1
                if index < tokens.count {
                    formData.append(keyValue(from: tokens[index]))
                }
            case "--url":
                index += 1
                if index < tokens.count { urlString = tokens[index] }
            default:
                if token.hasPrefix("http://") || token.hasPrefix("https://") {
                    urlString = token
                }
            }
            index += 1
        }

        guard let urlString, !urlString.isEmpty else { throw CurlParseError.missingURL }
        if let components = URLComponents(string: urlString) {
            var baseComponents = components
            baseComponents.queryItems = nil
            request.url = baseComponents.url?.absoluteString ?? urlString
            request.queryItems = components.queryItems?.map {
                KeyValueItem(key: $0.name, value: $0.value ?? "")
            } ?? [KeyValueItem()]
        } else {
            request.url = urlString
        }

        request.headers = headers.isEmpty ? [KeyValueItem()] : headers
        if !formData.isEmpty {
            request.bodyKind = .formData
            request.formData = formData
        } else if !encodedData.isEmpty {
            request.bodyKind = .urlEncoded
            request.urlEncodedData = encodedData
        } else if let body {
            request.rawBody = body
            let contentType = headers.first { $0.key.caseInsensitiveCompare("Content-Type") == .orderedSame }?.value.lowercased()
            request.bodyKind = contentType?.contains("json") == true || isJSONObject(body) ? .json : .text
            if request.method == .get { request.method = .post }
        }

        request.name = "Imported Request"
        return request
    }

    private static func tokenize(_ command: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var quote: Character?
        var escaping = false

        for character in command.replacingOccurrences(of: "\\\n", with: " ") {
            if escaping {
                current.append(character)
                escaping = false
            } else if character == "\\" && quote != "'" {
                escaping = true
            } else if let activeQuote = quote {
                if character == activeQuote {
                    quote = nil
                } else {
                    current.append(character)
                }
            } else if character == "\"" || character == "'" {
                quote = character
            } else if character.isWhitespace {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
            } else {
                current.append(character)
            }
        }
        if !current.isEmpty { tokens.append(current) }
        return tokens
    }

    private static func keyValue(from value: String) -> KeyValueItem {
        let pieces = value.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
        return KeyValueItem(
            key: pieces.first.map(String.init) ?? "",
            value: pieces.count > 1 ? String(pieces[1]) : ""
        )
    }

    private static func shellQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }

    private static func hasContentType(in headers: [KeyValueItem]) -> Bool {
        headers.contains { $0.isEnabled && $0.key.caseInsensitiveCompare("Content-Type") == .orderedSame }
    }

    private static func isJSONObject(_ value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        return (try? JSONSerialization.jsonObject(with: data)) != nil
    }
}
