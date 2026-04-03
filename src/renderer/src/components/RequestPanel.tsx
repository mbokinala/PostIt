import { useState, useEffect, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { useRequestStore } from '../stores/requestStore'
import KeyValueEditor from './KeyValueEditor'
import type { HttpMethod, BodyType } from '@shared/ipc'
import { isCurlCommand, parseCurl } from '../utils/parseCurl'
import { toCurl } from '../utils/toCurl'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-slate-400',
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
    importCurl,
    sendRequest,
  } = useRequestStore()

  const handleSend = () => {
    if (!activeRequest.url.trim()) return
    sendRequest()
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMessage(null), 2000)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (isCurlCommand(text)) {
      e.preventDefault()
      const parsed = parseCurl(text)
      if (parsed) {
        importCurl(parsed)
        showToast('Curl command imported')
      }
    }
  }

  const handleCopyAsCurl = () => {
    const curl = toCurl(activeRequest)
    navigator.clipboard.writeText(curl)
    showToast('Copied as cURL')
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
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3">
        {/* Method Dropdown */}
        <select
          value={activeRequest.method}
          onChange={(e) => updateMethod(e.target.value as HttpMethod)}
          className={`bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer ${METHOD_COLORS[activeRequest.method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-slate-200">
              {m}
            </option>
          ))}
        </select>

        {/* URL Input */}
        <input
          type="text"
          placeholder="Enter request URL or paste curl command..."
          value={activeRequest.url}
          onChange={(e) => updateUrl(e.target.value)}
          onPaste={handlePaste}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />

        {/* Copy as cURL */}
        <button
          onClick={handleCopyAsCurl}
          disabled={!activeRequest.url.trim()}
          title="Copy as cURL"
          className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-300 border border-slate-700 px-2.5 py-2 rounded-lg text-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5v-3.379a3 3 0 00-.879-2.121l-3.12-3.121a3 3 0 00-1.402-.791 2.252 2.252 0 011.913-1.576A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-.25z" clipRule="evenodd" />
            <path d="M3.5 6A1.5 1.5 0 002 7.5v9A1.5 1.5 0 003.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L8.44 6.439A1.5 1.5 0 007.378 6H3.5z" />
          </svg>
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading || !activeRequest.url.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
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

      {/* Toast */}
      {toastMessage && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-green-900/50 border border-green-700/50 rounded-lg text-green-300 text-xs font-medium animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-700 px-3">
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
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {count > 0 && (
                <span className="ml-1.5 bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {bt.label}
                </button>
              ))}
            </div>

            {/* Body Content */}
            {activeRequest.body.type === 'none' && (
              <p className="text-sm text-slate-500 italic">
                This request does not have a body.
              </p>
            )}

            {activeRequest.body.type === 'json' && (
              <div className="border border-slate-700 rounded-lg overflow-hidden">
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y font-mono"
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
