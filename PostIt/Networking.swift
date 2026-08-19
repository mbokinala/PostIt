import Foundation

enum RequestError: LocalizedError {
    case invalidURL
    case nonHTTPResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL: "Enter a valid URL, including http:// or https://."
        case .nonHTTPResponse: "The server returned an unsupported response."
        }
    }
}

enum NetworkService {
    static func send(_ apiRequest: APIRequest) async throws -> APIResponse {
        let request = try makeURLRequest(from: apiRequest)
        let startedAt = Date()
        let (data, response) = try await URLSession.shared.data(for: request)
        let duration = Date().timeIntervalSince(startedAt) * 1_000

        guard let httpResponse = response as? HTTPURLResponse,
              let responseURL = httpResponse.url else {
            throw RequestError.nonHTTPResponse
        }

        let headers = httpResponse.allHeaderFields
            .map { (name: String(describing: $0.key), value: String(describing: $0.value)) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let reason = HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
        let rawResponse = makeRawResponse(
            statusCode: httpResponse.statusCode,
            reason: reason,
            headers: headers,
            data: data
        )

        return APIResponse(
            statusCode: httpResponse.statusCode,
            reason: reason.capitalized,
            durationMilliseconds: duration,
            data: data,
            headers: headers,
            requestURL: responseURL,
            rawRequest: makeRawRequest(request),
            rawResponse: rawResponse
        )
    }

    static func resolvedURL(for apiRequest: APIRequest) throws -> URL {
        let trimmedURL = apiRequest.url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(string: trimmedURL),
              let scheme = components.scheme?.lowercased(),
              scheme == "http" || scheme == "https" else {
            throw RequestError.invalidURL
        }

        var items = components.queryItems ?? []
        items.append(contentsOf: apiRequest.queryItems
            .filter { $0.isEnabled && !$0.key.isEmpty }
            .map { URLQueryItem(name: $0.key, value: $0.value) })
        components.queryItems = items.isEmpty ? nil : items

        guard let url = components.url else { throw RequestError.invalidURL }
        return url
    }

    static func makeURLRequest(from apiRequest: APIRequest) throws -> URLRequest {
        var request = URLRequest(url: try resolvedURL(for: apiRequest))
        request.httpMethod = apiRequest.method.rawValue
        request.timeoutInterval = 60

        for header in apiRequest.headers where header.isEnabled && !header.key.isEmpty {
            request.addValue(header.value, forHTTPHeaderField: header.key)
        }

        let enabledCookies = apiRequest.cookies.filter { $0.isEnabled && !$0.key.isEmpty }
        if !enabledCookies.isEmpty {
            request.setValue(
                enabledCookies.map { "\($0.key)=\($0.value)" }.joined(separator: "; "),
                forHTTPHeaderField: "Cookie"
            )
        }

        switch apiRequest.bodyKind {
        case .none:
            break
        case .json:
            request.httpBody = apiRequest.rawBody.data(using: .utf8)
            setContentType("application/json", on: &request)
        case .text:
            request.httpBody = apiRequest.rawBody.data(using: .utf8)
            setContentType("text/plain; charset=utf-8", on: &request)
        case .urlEncoded:
            let body = apiRequest.urlEncodedData
                .filter { $0.isEnabled && !$0.key.isEmpty }
                .map { item in
                    "\(formEncode(item.key))=\(formEncode(item.value))"
                }
                .joined(separator: "&")
            request.httpBody = body.data(using: .utf8)
            setContentType("application/x-www-form-urlencoded", on: &request)
        case .formData:
            let boundary = "PostIt-\(UUID().uuidString)"
            var data = Data()
            for item in apiRequest.formData where item.isEnabled && !item.key.isEmpty {
                data.appendUTF8("--\(boundary)\r\n")
                data.appendUTF8("Content-Disposition: form-data; name=\"\(item.key)\"\r\n\r\n")
                data.appendUTF8("\(item.value)\r\n")
            }
            data.appendUTF8("--\(boundary)--\r\n")
            request.httpBody = data
            setContentType("multipart/form-data; boundary=\(boundary)", on: &request)
        }

        return request
    }

    private static func setContentType(_ contentType: String, on request: inout URLRequest) {
        if request.value(forHTTPHeaderField: "Content-Type") == nil {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
    }

    private static func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed)?
            .replacingOccurrences(of: "%20", with: "+") ?? value
    }

    private static func makeRawRequest(_ request: URLRequest) -> String {
        let url = request.url ?? URL(string: "about:blank")!
        let path = url.path.isEmpty ? "/" : url.path
        let target = url.query.map { "\(path)?\($0)" } ?? path
        var lines = ["\(request.httpMethod ?? "GET") \(target) HTTP/1.1"]
        lines.append("Host: \(url.host ?? "")")
        for (name, value) in request.allHTTPHeaderFields?.sorted(by: { $0.key < $1.key }) ?? [] {
            lines.append("\(name): \(value)")
        }
        if let body = request.httpBody, !body.isEmpty {
            lines.append("")
            lines.append(String(data: body, encoding: .utf8) ?? "<\(body.count) bytes>")
        }
        return lines.joined(separator: "\n")
    }

    private static func makeRawResponse(
        statusCode: Int,
        reason: String,
        headers: [(name: String, value: String)],
        data: Data
    ) -> String {
        var lines = ["HTTP/1.1 \(statusCode) \(reason.capitalized)"]
        lines.append(contentsOf: headers.map { "\($0.name): \($0.value)" })
        if !data.isEmpty {
            lines.append("")
            lines.append(String(data: data, encoding: .utf8) ?? "<\(data.count) bytes>")
        }
        return lines.joined(separator: "\n")
    }
}

private extension Data {
    mutating func appendUTF8(_ string: String) {
        append(contentsOf: string.utf8)
    }
}
