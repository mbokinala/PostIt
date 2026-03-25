import { create } from 'zustand'
import type {
  RestRequest,
  RestResponse,
  HttpMethod,
  BodyType,
  KeyValuePair,
  Collection,
  HistoryEntry
} from '@shared/ipc'
import type { ParsedCurl } from '../utils/parseCurl'
import { v4 as uuidv4 } from 'uuid'

// --- Helper to create a blank request ---

export function createBlankRequest(): RestRequest {
  return {
    id: uuidv4(),
    name: 'New Request',
    method: 'GET' as HttpMethod,
    url: '',
    headers: [{ id: uuidv4(), key: '', value: '', enabled: true }],
    params: [{ id: uuidv4(), key: '', value: '', enabled: true }],
    cookies: [{ id: uuidv4(), key: '', value: '', enabled: true }],
    body: { type: 'none' as BodyType, content: '', formData: [] }
  }
}

// --- Store Types ---

interface RequestState {
  // Current request being edited
  activeRequest: RestRequest
  // Response from the last send
  activeResponse: RestResponse | null
  // Loading state
  loading: boolean

  // Collections
  collections: Collection[]
  // History
  history: HistoryEntry[]

  // Active sidebar tab
  sidebarTab: 'collections' | 'history'

  // Actions
  setActiveRequest: (req: RestRequest) => void
  updateMethod: (method: HttpMethod) => void
  updateUrl: (url: string) => void
  updateHeaders: (headers: KeyValuePair[]) => void
  updateParams: (params: KeyValuePair[]) => void
  updateCookies: (cookies: KeyValuePair[]) => void
  updateBodyType: (type: BodyType) => void
  updateBodyContent: (content: string) => void
  updateBodyFormData: (formData: KeyValuePair[]) => void

  importCurl: (parsed: ParsedCurl) => void
  sendRequest: () => Promise<void>
  resetRequest: () => void

  // Collections
  loadCollections: () => Promise<void>
  saveCollection: (collection: Collection) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  // History
  loadHistory: () => Promise<void>
  clearHistory: () => Promise<void>

  setSidebarTab: (tab: 'collections' | 'history') => void
}

export const useRequestStore = create<RequestState>((set, get) => ({
  activeRequest: createBlankRequest(),
  activeResponse: null,
  loading: false,
  collections: [],
  history: [],
  sidebarTab: 'collections',

  setActiveRequest: (req) => set({ activeRequest: req, activeResponse: null }),
  updateMethod: (method) =>
    set((s) => ({ activeRequest: { ...s.activeRequest, method } })),
  updateUrl: (url) =>
    set((s) => ({ activeRequest: { ...s.activeRequest, url } })),
  updateHeaders: (headers) =>
    set((s) => ({ activeRequest: { ...s.activeRequest, headers } })),
  updateParams: (params) =>
    set((s) => ({ activeRequest: { ...s.activeRequest, params } })),
  updateCookies: (cookies) =>
    set((s) => ({ activeRequest: { ...s.activeRequest, cookies } })),
  updateBodyType: (type) =>
    set((s) => ({
      activeRequest: {
        ...s.activeRequest,
        body: { ...s.activeRequest.body, type }
      }
    })),
  updateBodyContent: (content) =>
    set((s) => ({
      activeRequest: {
        ...s.activeRequest,
        body: { ...s.activeRequest.body, content }
      }
    })),
  updateBodyFormData: (formData) =>
    set((s) => ({
      activeRequest: {
        ...s.activeRequest,
        body: { ...s.activeRequest.body, formData }
      }
    })),

  importCurl: (parsed) =>
    set((s) => ({
      activeRequest: {
        ...s.activeRequest,
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        params: parsed.params,
        cookies: parsed.cookies,
        body: parsed.body,
      }
    })),

  sendRequest: async () => {
    const { activeRequest } = get()
    set({ loading: true, activeResponse: null })
    try {
      const response = await window.api.sendRequest(activeRequest)
      set({ activeResponse: response, loading: false })

      // Save to history
      const entry: HistoryEntry = {
        id: uuidv4(),
        request: activeRequest,
        response,
        timestamp: Date.now()
      }
      await window.api.saveHistoryEntry(entry)
      // Refresh history in state
      const history = await window.api.getHistory()
      set({ history })
    } catch (err: any) {
      set({
        loading: false,
        activeResponse: {
          status: 0,
          statusText: 'Request failed',
          headers: {},
          body: err?.message || 'An unexpected error occurred',
          size: 0,
          time: 0
        }
      })
    }
  },

  resetRequest: () =>
    set({ activeRequest: createBlankRequest(), activeResponse: null }),

  loadCollections: async () => {
    const collections = await window.api.getCollections()
    set({ collections })
  },
  saveCollection: async (collection) => {
    await window.api.saveCollection(collection)
    const collections = await window.api.getCollections()
    set({ collections })
  },
  deleteCollection: async (id) => {
    await window.api.deleteCollection(id)
    const collections = await window.api.getCollections()
    set({ collections })
  },

  loadHistory: async () => {
    const history = await window.api.getHistory()
    set({ history })
  },
  clearHistory: async () => {
    await window.api.clearHistory()
    set({ history: [] })
  },

  setSidebarTab: (tab) => set({ sidebarTab: tab })
}))
