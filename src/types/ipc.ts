// ============================================================
// Shared IPC Types for REST Client
// Used by main process, preload, and renderer
// ============================================================

// --- HTTP Method Types ---

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

// --- Key-Value Pair (used for headers, params, form data) ---

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

// --- Request Body Types ---

export type BodyType = 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded'

export interface RequestBody {
  type: BodyType
  content: string // raw content for json/text, ignored for none
  formData: KeyValuePair[] // used for form-data and x-www-form-urlencoded
}

// --- Request Definition ---

export interface RestRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  params: KeyValuePair[]
  cookies: KeyValuePair[]
  body: RequestBody
}

// --- Response Definition ---

export interface RestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number // bytes
  time: number // milliseconds
  rawRequest: string
}

// --- History Entry ---

export interface HistoryEntry {
  id: string
  request: RestRequest
  response: RestResponse
  timestamp: number
}

// --- Collection ---

export interface Collection {
  id: string
  name: string
  requests: RestRequest[]
}

// ============================================================
// IPC Channel Names and Payloads
// ============================================================

// Channel: 'rest:send-request'
// Direction: renderer -> main
// Sends an HTTP request from the main process (avoids CORS)
// Payload: RestRequest
// Returns: RestResponse

// Channel: 'store:get-collections'
// Direction: renderer -> main
// Returns: Collection[]

// Channel: 'store:save-collection'
// Direction: renderer -> main
// Payload: Collection
// Returns: void

// Channel: 'store:delete-collection'
// Direction: renderer -> main
// Payload: { id: string }
// Returns: void

// Channel: 'store:get-history'
// Direction: renderer -> main
// Returns: HistoryEntry[]

// Channel: 'store:save-history-entry'
// Direction: renderer -> main
// Payload: HistoryEntry
// Returns: void

// Channel: 'store:clear-history'
// Direction: renderer -> main
// Returns: void

export const IPC_CHANNELS = {
  SEND_REQUEST: 'rest:send-request',
  CANCEL_REQUEST: 'rest:cancel-request',
  GET_COLLECTIONS: 'store:get-collections',
  SAVE_COLLECTION: 'store:save-collection',
  DELETE_COLLECTION: 'store:delete-collection',
  GET_HISTORY: 'store:get-history',
  SAVE_HISTORY_ENTRY: 'store:save-history-entry',
  CLEAR_HISTORY: 'store:clear-history',
} as const

// Type-safe IPC API exposed to the renderer via contextBridge
export interface ElectronAPI {
  sendRequest: (request: RestRequest) => Promise<RestResponse>
  cancelRequest: (requestId: string) => Promise<void>
  getCollections: () => Promise<Collection[]>
  saveCollection: (collection: Collection) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  getHistory: () => Promise<HistoryEntry[]>
  saveHistoryEntry: (entry: HistoryEntry) => Promise<void>
  clearHistory: () => Promise<void>
}

// Augment the Window interface so renderer code can use window.api
declare global {
  interface Window {
    api: ElectronAPI
  }
}
