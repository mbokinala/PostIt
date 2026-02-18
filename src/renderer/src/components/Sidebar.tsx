import { useEffect, useState } from 'react'
import { useRequestStore } from '../stores/requestStore'
import { v4 as uuidv4 } from 'uuid'
import type { HttpMethod } from '@shared/ipc'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400',
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

  useEffect(() => {
    loadCollections()
    loadHistory()
  }, [loadCollections, loadHistory])

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
    <aside className="w-64 flex-shrink-0 border-r border-gray-700 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-200 tracking-wide uppercase">REST Client</h1>
          <button
            onClick={resetRequest}
            className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
            title="New request"
          >
            + New
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setSidebarTab('collections')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === 'collections'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setSidebarTab('history')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === 'history'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-300'
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
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateCollection}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-1 rounded transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCollection(false)
                      setNewCollectionName('')
                    }}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 py-1 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="w-full text-left text-xs text-gray-500 hover:text-indigo-400 px-2 py-1.5 transition-colors"
              >
                + New Collection
              </button>
            )}

            {collections.length === 0 && !showNewCollection && (
              <p className="text-xs text-gray-600 px-2 py-4 text-center">No collections yet</p>
            )}

            {collections.map((collection) => (
              <div key={collection.id} className="group">
                <div className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 rounded">
                  <span className="font-medium text-xs truncate">{collection.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleSaveToCollection(collection.id)}
                      className="text-xs text-gray-500 hover:text-indigo-400"
                      title="Save current request here"
                    >
                      +
                    </button>
                    <button
                      onClick={() => deleteCollection(collection.id)}
                      className="text-xs text-gray-500 hover:text-red-400"
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
                    className="w-full text-left flex items-center gap-2 px-4 py-1 hover:bg-gray-800 rounded transition-colors"
                  >
                    <span className={`text-xs font-bold w-12 ${METHOD_COLORS[req.method]}`}>
                      {req.method}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
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
                className="w-full text-left text-xs text-gray-600 hover:text-red-400 px-2 py-1 transition-colors"
              >
                Clear History
              </button>
            )}

            {history.length === 0 && (
              <p className="text-xs text-gray-600 px-2 py-4 text-center">No history yet</p>
            )}

            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActiveRequest(entry.request)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 rounded transition-colors group"
              >
                <span className={`text-xs font-bold w-12 flex-shrink-0 ${METHOD_COLORS[entry.request.method]}`}>
                  {entry.request.method}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-400 truncate block">
                    {entry.request.url || 'Untitled'}
                  </span>
                  <span className="text-xs text-gray-600">{formatTimestamp(entry.timestamp)}</span>
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
    </aside>
  )
}
