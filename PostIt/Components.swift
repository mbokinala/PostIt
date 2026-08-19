import AppKit
import SwiftUI

struct MethodBadge: View {
    let method: HTTPMethod
    var compact = false

    var body: some View {
        Text(method.rawValue)
            .font(.system(size: compact ? 9 : 11, weight: .semibold, design: .rounded))
            .foregroundStyle(method.color)
            .frame(minWidth: compact ? 36 : 44, alignment: .leading)
    }
}

struct KeyValueEditor: View {
    @Binding var items: [KeyValueItem]
    let keyTitle: String
    let valueTitle: String

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Color.clear.frame(width: 18)
                Text(keyTitle).frame(maxWidth: .infinity, alignment: .leading)
                Divider()
                Text(valueTitle).frame(maxWidth: .infinity, alignment: .leading)
                Color.clear.frame(width: 24)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background(.quaternary.opacity(0.35))

            Divider()

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach($items) { $item in
                        HStack(spacing: 8) {
                            Toggle("", isOn: $item.isEnabled)
                                .labelsHidden()
                                .toggleStyle(.checkbox)
                                .frame(width: 18)
                            TextField(keyTitle, text: $item.key)
                                .textFieldStyle(.plain)
                                .frame(maxWidth: .infinity)
                            Divider()
                            TextField(valueTitle, text: $item.value)
                                .textFieldStyle(.plain)
                                .frame(maxWidth: .infinity)
                            Button {
                                items.removeAll { $0.id == item.id }
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundStyle(.tertiary)
                            }
                            .buttonStyle(.plain)
                            .help("Remove row")
                        }
                        .padding(.horizontal, 10)
                        .frame(height: 32)
                        .opacity(item.isEnabled ? 1 : 0.55)
                        Divider().padding(.leading, 36)
                    }
                }
            }

            Divider()
            HStack {
                Button {
                    items.append(KeyValueItem())
                } label: {
                    Label("Add Row", systemImage: "plus")
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                Spacer()
                Text("\(items.filter { $0.isEnabled && !$0.key.isEmpty }.count) enabled")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 12)
            .frame(height: 34)
        }
        .background(.background)
    }
}

struct CodeSurface: View {
    let text: AttributedString

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            Text(text)
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(14)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

enum SyntaxHighlighter {
    static func json(_ source: String) -> AttributedString {
        var result = AttributedString(source)
        result.foregroundColor = .primary

        color(pattern: #"\"(?:\\.|[^\"\\])*\"(?=\s*:)"#, in: &result, source: source, color: .blue)
        color(pattern: #"(?<=:)\s*\"(?:\\.|[^\"\\])*\""#, in: &result, source: source, color: .green)
        color(pattern: #"\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b"#, in: &result, source: source, color: .purple)
        color(pattern: #"\b(?:true|false|null)\b"#, in: &result, source: source, color: .orange)
        return result
    }

    static func plain(_ source: String) -> AttributedString {
        AttributedString(source)
    }

    private static func color(
        pattern: String,
        in result: inout AttributedString,
        source: String,
        color: Color
    ) {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
        let fullRange = NSRange(source.startIndex..., in: source)
        for match in regex.matches(in: source, range: fullRange) {
            guard let stringRange = Range(match.range, in: source),
                  let attributedRange = Range(stringRange, in: result) else { continue }
            result[attributedRange].foregroundColor = color
        }
    }
}

enum Clipboard {
    static func copy(_ string: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(string, forType: .string)
    }
}

extension View {
    func postItCard() -> some View {
        clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(.separator.opacity(0.55), lineWidth: 1)
            }
    }
}
