import SwiftUI

struct ResponseView: View {
    let response: APIResponse?
    @State private var selectedTab: ResponseViewerTab = .body
    @State private var prettyPrintJSON = true

    var body: some View {
        VStack(spacing: 0) {
            if let response {
                responseHeader(response)
                Divider()
                responseToolbar(response)
                Divider()
                responseContent(response)
            } else {
                emptyState
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private func responseHeader(_ response: APIResponse) -> some View {
        HStack(spacing: 14) {
            Label("Response", systemImage: "arrow.down.left.circle")
                .font(.headline)
            Spacer()
            metric("Status", value: "\(response.statusCode) \(response.reason)", color: response.isSuccess ? .green : .orange)
            Divider().frame(height: 20)
            metric("Time", value: formattedDuration(response.durationMilliseconds), color: .primary)
            Divider().frame(height: 20)
            metric("Size", value: response.formattedSize, color: .primary)
        }
        .padding(.horizontal, 14)
        .frame(height: 45)
    }

    private func responseToolbar(_ response: APIResponse) -> some View {
        HStack {
            Picker("Response View", selection: $selectedTab) {
                ForEach(ResponseViewerTab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .labelsHidden()
            .pickerStyle(.segmented)
            .frame(maxWidth: 390)

            Spacer()

            if selectedTab == .body && canFormatJSON(response.bodyText) {
                Toggle("Pretty JSON", isOn: $prettyPrintJSON)
                    .toggleStyle(.switch)
                    .controlSize(.small)
            }

            Button {
                Clipboard.copy(copyableText(for: response))
            } label: {
                Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.borderless)
            .help("Copy")
        }
        .padding(.horizontal, 14)
        .frame(height: 43)
    }

    @ViewBuilder
    private func responseContent(_ response: APIResponse) -> some View {
        switch selectedTab {
        case .body:
            let text = displayBody(response.bodyText)
            CodeSurface(text: canFormatJSON(text) ? SyntaxHighlighter.json(text) : SyntaxHighlighter.plain(text))
        case .headers:
            headersView(response.headers)
        case .console:
            consoleView(response)
        }
    }

    private func headersView(_ headers: [(name: String, value: String)]) -> some View {
        ScrollView {
            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 0) {
                ForEach(Array(headers.enumerated()), id: \.offset) { index, header in
                    GridRow {
                        Text(header.name)
                            .fontWeight(.medium)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(header.value)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    if index < headers.count - 1 {
                        Divider().gridCellUnsizedAxes(.horizontal)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    private func consoleView(_ response: APIResponse) -> some View {
        ScrollView([.horizontal, .vertical]) {
            VStack(alignment: .leading, spacing: 18) {
                consoleSection("Request", systemImage: "arrow.up.right", content: response.rawRequest)
                Divider()
                consoleSection("Response", systemImage: "arrow.down.left", content: response.rawResponse)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    private func consoleSection(_ title: String, systemImage: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(verbatim: content)
                .font(.system(.callout, design: .monospaced))
                .textSelection(.enabled)
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Ready to Send", systemImage: "paperplane")
        } description: {
            Text("The response body, headers, timing, and raw exchange will appear here.")
        } actions: {
            Text("Press ⌘↩ to send")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func metric(_ title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.tertiary)
            Text(value)
                .font(.callout.monospacedDigit().weight(.medium))
                .foregroundStyle(color)
        }
    }

    private func formattedDuration(_ milliseconds: Double) -> String {
        milliseconds < 1_000
            ? "\(Int(milliseconds.rounded())) ms"
            : String(format: "%.2f s", milliseconds / 1_000)
    }

    private func displayBody(_ body: String) -> String {
        guard prettyPrintJSON,
              let data = body.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              let formatted = try? JSONSerialization.data(
                withJSONObject: object,
                options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
              ),
              let string = String(data: formatted, encoding: .utf8) else { return body }
        return string
    }

    private func canFormatJSON(_ body: String) -> Bool {
        guard let data = body.data(using: .utf8) else { return false }
        return (try? JSONSerialization.jsonObject(with: data)) != nil
    }

    private func copyableText(for response: APIResponse) -> String {
        switch selectedTab {
        case .body: displayBody(response.bodyText)
        case .headers: response.headers.map { "\($0.name): \($0.value)" }.joined(separator: "\n")
        case .console: "\(response.rawRequest)\n\n\(response.rawResponse)"
        }
    }
}
