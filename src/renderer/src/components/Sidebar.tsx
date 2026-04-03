import { useEffect, useRef, useState } from 'react'
import { useRequestStore } from '../stores/requestStore'
import { v4 as uuidv4 } from 'uuid'
import type { HistoryEntry, HttpMethod } from '@shared/ipc'
import { toCurl } from '../utils/toCurl'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-slate-400',
}

export default function Sidebar() {
  const {
    sidebarTab,
    setSidebarTab,
    collections,
    history,
    loadCollections,
    loadHistory,
    saveCollection,
    deleteCollection,
    clearHistory,
    setActiveRequest,
    activeRequest,
    resetRequest,
  } = useRequestStore()

  const [newCollectionName, setNewCollectionName] = useState('')
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null)
  const [copyToast, setCopyToast] = useState(false)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    loadCollections()
    loadHistory()
  }, [loadCollections, loadHistory])

  useEffect(() => {
    if (!contextMenu) return
    const dismiss = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const dismissKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', dismissKey)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', dismissKey)
    }
  }, [contextMenu])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const handleCopyAsCurl = (entry: HistoryEntry) => {
    const curl = toCurl(entry.request)
    navigator.clipboard.writeText(curl)
    setContextMenu(null)
    setCopyToast(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setCopyToast(false), 2000)
  }

  const handleSaveToCollection = (collectionId: string) => {
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) return

    const exists = collection.requests.find((r) => r.id === activeRequest.id)
    const updatedRequests = exists
      ? collection.requests.map((r) => (r.id === activeRequest.id ? activeRequest : r))
      : [...collection.requests, activeRequest]

    saveCollection({ ...collection, requests: updatedRequests })
  }

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return
    saveCollection({
      id: uuidv4(),
      name: newCollectionName.trim(),
      requests: [],
    })
    setNewCollectionName('')
    setShowNewCollection(false)
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return d.toLocaleDateString()
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-700 bg-slate-900 flex flex-col relative">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-slate-200 tracking-wide uppercase">REST Client</h1>
          <button
            onClick={resetRequest}
            className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
            title="New request"
          >
            + New
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setSidebarTab('collections')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === 'collections'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setSidebarTab('history')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === 'history'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'collections' && (
          <div className="p-2 space-y-1">
            {/* New Collection */}
            {showNewCollection ? (
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateCollection}
                    className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white py-1 rounded transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCollection(false)
                      setNewCollectionName('')
                    }}
                    className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 py-1 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="w-full text-left text-xs text-slate-500 hover:text-blue-400 px-2 py-1.5 transition-colors"
              >
                + New Collection
              </button>
            )}

            {collections.length === 0 && !showNewCollection && (
              <p className="text-xs text-slate-600 px-2 py-4 text-center">No collections yet</p>
            )}

            {collections.map((collection) => (
              <div key={collection.id} className="group">
                <div className="flex items-center justify-between px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 rounded">
                  <span className="font-medium text-xs truncate">{collection.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleSaveToCollection(collection.id)}
                      className="text-xs text-slate-500 hover:text-blue-400"
                      title="Save current request here"
                    >
                      +
                    </button>
                    <button
                      onClick={() => deleteCollection(collection.id)}
                      className="text-xs text-slate-500 hover:text-red-400"
                      title="Delete collection"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                {collection.requests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setActiveRequest(req)}
                    className="w-full text-left flex items-center gap-2 px-4 py-1 hover:bg-slate-800 rounded transition-colors"
                  >
                    <span className={`text-xs font-bold w-12 ${METHOD_COLORS[req.method]}`}>
                      {req.method}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {req.name || req.url || 'Untitled'}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {sidebarTab === 'history' && (
          <div className="p-2 space-y-0.5">
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="w-full text-left text-xs text-slate-600 hover:text-red-400 px-2 py-1 transition-colors"
              >
                Clear History
              </button>
            )}

            {history.length === 0 && (
              <p className="text-xs text-slate-600 px-2 py-4 text-center">No history yet</p>
            )}

            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActiveRequest(entry.request)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, entry })
                }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded transition-colors group"
              >
                <span className={`text-xs font-bold w-12 flex-shrink-0 ${METHOD_COLORS[entry.request.method]}`}>
                  {entry.request.method}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-400 truncate block">
                    {entry.request.url || 'Untitled'}
                  </span>
                  <span className="text-xs text-slate-600">{formatTimestamp(entry.timestamp)}</span>
                </div>
                <span
                  className={`text-xs font-mono flex-shrink-0 ${
                    entry.response.status < 300
                      ? 'text-green-500'
                      : entry.response.status < 400
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}
                >
                  {entry.response.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleCopyAsCurl(contextMenu.entry)}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Copy as cURL
          </button>
        </div>
      )}

      {/* Copy toast */}
      {copyToast && (
        <div className="absolute bottom-3 left-3 right-3 px-3 py-1.5 bg-green-900/50 border border-green-700/50 rounded-lg text-green-300 text-xs font-medium animate-fade-in text-center">
          Copied as cURL
        </div>
      )}
    </aside>
  )
}
