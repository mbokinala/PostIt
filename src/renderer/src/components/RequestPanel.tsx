import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { useRequestStore } from '../stores/requestStore'
import KeyValueEditor from './KeyValueEditor'
import type { HttpMethod, BodyType } from '@shared/ipc'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400',
}

type Tab = 'params' | 'headers' | 'cookies' | 'body'

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Raw Text' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
]

export default function RequestPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('params')
  const {
    activeRequest,
    loading,
    updateMethod,
    updateUrl,
    updateHeaders,
    updateParams,
    updateCookies,
    updateBodyType,
    updateBodyContent,
    updateBodyFormData,
    sendRequest,
  } = useRequestStore()

  const handleSend = () => {
    if (!activeRequest.url.trim()) return
    sendRequest()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend()
    }
  }

  const enabledParamsCount = activeRequest.params.filter((p) => p.enabled && p.key).length
  const enabledHeadersCount = activeRequest.headers.filter((h) => h.enabled && h.key).length
  const enabledCookiesCount = (activeRequest.cookies ?? []).filter((c) => c.enabled && c.key).length

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3" onKeyDown={handleKeyDown}>
        {/* Method Dropdown */}
        <select
          value={activeRequest.method}
          onChange={(e) => updateMethod(e.target.value as HttpMethod)}
          className={`bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer ${METHOD_COLORS[activeRequest.method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-gray-200">
              {m}
            </option>
          ))}
        </select>

        {/* URL Input */}
        <input
          type="text"
          placeholder="Enter request URL..."
          value={activeRequest.url}
          onChange={(e) => updateUrl(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading || !activeRequest.url.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-700 px-3">
        {(['params', 'headers', 'cookies', 'body'] as Tab[]).map((tab) => {
          const count =
            tab === 'params'
              ? enabledParamsCount
              : tab === 'headers'
                ? enabledHeadersCount
                : tab === 'cookies'
                  ? enabledCookiesCount
                  : 0
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {count > 0 && (
                <span className="ml-1.5 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'params' && (
          <KeyValueEditor pairs={activeRequest.params} onChange={updateParams} />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor pairs={activeRequest.headers} onChange={updateHeaders} />
        )}

        {activeTab === 'cookies' && (
          <KeyValueEditor pairs={activeRequest.cookies ?? []} onChange={updateCookies} />
        )}

        {activeTab === 'body' && (
          <div className="space-y-3">
            {/* Body Type Selector */}
            <div className="flex items-center gap-1">
              {BODY_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => updateBodyType(bt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeRequest.body.type === bt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  {bt.label}
                </button>
              ))}
            </div>

            {/* Body Content */}
            {activeRequest.body.type === 'none' && (
              <p className="text-sm text-gray-500 italic">
                This request does not have a body.
              </p>
            )}

            {activeRequest.body.type === 'json' && (
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <CodeMirror
                  value={activeRequest.body.content}
                  onChange={updateBodyContent}
                  extensions={[json()]}
                  theme="dark"
                  height="200px"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    bracketMatching: true,
                    closeBrackets: true,
                  }}
                />
              </div>
            )}

            {activeRequest.body.type === 'text' && (
              <textarea
                value={activeRequest.body.content}
                onChange={(e) => updateBodyContent(e.target.value)}
                placeholder="Enter raw text body..."
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y font-mono"
              />
            )}

            {(activeRequest.body.type === 'form-data' ||
              activeRequest.body.type === 'x-www-form-urlencoded') && (
              <KeyValueEditor
                pairs={activeRequest.body.formData}
                onChange={updateBodyFormData}
                showEnabled={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
