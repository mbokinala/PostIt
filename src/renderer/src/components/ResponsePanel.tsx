import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { useRequestStore } from '../stores/requestStore'

type Tab = 'body' | 'headers' | 'console'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-600'
  if (status >= 300 && status < 400) return 'bg-yellow-600'
  if (status >= 400 && status < 500) return 'bg-red-500'
  if (status >= 500) return 'bg-red-700'
  return 'bg-gray-600'
}

function detectContentType(headers: Record<string, string>): string {
  const ct = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === 'content-type'
  )?.[1] ?? ''
  if (ct.includes('json')) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  return 'text'
}

function tryPrettyPrint(body: string, contentType: string): string {
  if (contentType === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }
  return body
}

export default function ResponsePanel() {
  const { activeResponse, loading } = useRequestStore()
  const [activeTab, setActiveTab] = useState<Tab>('body')
  const [prettyPrint, setPrettyPrint] = useState(true)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Sending request...</span>
        </div>
      </div>
    )
  }

  if (!activeResponse) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <p className="text-sm">Response will appear here</p>
          <p className="text-xs mt-1 text-gray-700">Send a request to get started</p>
        </div>
      </div>
    )
  }

  const isError = activeResponse.status === 0

  const contentType = detectContentType(activeResponse.headers)
  const displayBody = prettyPrint
    ? tryPrettyPrint(activeResponse.body, contentType)
    : activeResponse.body

  const extensions =
    contentType === 'json'
      ? [json()]
      : contentType === 'html'
        ? [html()]
        : contentType === 'xml'
          ? [xml()]
          : []

  return (
    <div className="flex flex-col h-full">
      {/* Error Banner */}
      {isError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border-b border-red-800/50">
          <span className="text-red-400 text-sm font-semibold">{activeResponse.statusText}</span>
          <span className="text-red-300/70 text-xs">{activeResponse.body}</span>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-700">
        <span
          className={`${getStatusColor(activeResponse.status)} text-white text-xs font-bold px-2 py-0.5 rounded`}
        >
          {isError ? 'Error' : `${activeResponse.status} ${activeResponse.statusText}`}
        </span>
        <span className="text-xs text-gray-500">
          {formatTime(activeResponse.time)}
        </span>
        <span className="text-xs text-gray-500">
          {formatBytes(activeResponse.size)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Tabs */}
          {(['body', 'headers', 'console'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === tab
                  ? 'bg-gray-700 text-gray-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'headers' && (
                <span className="ml-1 text-gray-600">
                  ({Object.keys(activeResponse.headers).length})
                </span>
              )}
            </button>
          ))}

          {/* Pretty Print Toggle */}
          {activeTab === 'body' && contentType === 'json' && (
            <button
              onClick={() => setPrettyPrint(!prettyPrint)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                prettyPrint
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
            >
              Pretty
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'body' && (
          <CodeMirror
            value={displayBody}
            extensions={extensions}
            theme="dark"
            readOnly
            height="100%"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
            }}
          />
        )}

        {activeTab === 'headers' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-3 py-2">
                  Header
                </th>
                <th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-3 py-2">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(activeResponse.headers).map(([key, value]) => (
                <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-3 py-1.5 text-indigo-400 font-mono">{key}</td>
                  <td className="px-3 py-1.5 text-gray-300 font-mono break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'console' && (() => {
          const rawResponse = [
            `HTTP/1.1 ${activeResponse.status} ${activeResponse.statusText}`,
            ...Object.entries(activeResponse.headers).map(([k, v]) => `${k}: ${v}`),
            '',
            activeResponse.body,
          ].join('\n')
          return (
            <pre className="p-3 text-xs font-mono text-green-300 whitespace-pre-wrap break-all leading-relaxed">
              {activeResponse.rawRequest || '(no request data)'}
              {'\n\n'}
              <span className="text-gray-500">{'─'.repeat(40)}</span>
              {'\n\n'}
              {rawResponse}
            </pre>
          )
        })()}
      </div>
    </div>
  )
}
