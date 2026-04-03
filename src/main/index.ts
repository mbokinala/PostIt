import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../types/ipc'
import type { RestRequest, RestResponse, Collection, HistoryEntry } from '../types/ipc'

// electron-store is ESM-only in v8+, so we lazy-import it
let store: any = null
async function getStore() {
  if (!store) {
    const Store = (await import('electron-store')).default
    store = new Store({
      defaults: {
        collections: [] as Collection[],
        history: [] as HistoryEntry[]
      }
    })
  }
  return store
}

// Track active requests for cancellation
const activeRequests = new Map<string, AbortController>()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'PostIt',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- HTTP Request Execution ---

async function executeRequest(request: RestRequest): Promise<RestResponse> {
  const startTime = Date.now()
  const controller = new AbortController()
  activeRequests.set(request.id, controller)

  // 30-second timeout
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    // Build URL with query params
    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return {
        status: 0,
        statusText: 'Invalid URL',
        headers: {},
        body: `Invalid URL: ${request.url}`,
        size: 0,
        time: Date.now() - startTime,
        rawRequest: ''
      }
    }

    for (const param of request.params) {
      if (param.enabled && param.key) {
        url.searchParams.append(param.key, param.value)
      }
    }

    // Build headers
    const headers: Record<string, string> = {}
    for (const h of request.headers) {
      if (h.enabled && h.key) {
        headers[h.key] = h.value
      }
    }

    // Build Cookie header from cookies array
    const cookieParts: string[] = []
    for (const c of request.cookies ?? []) {
      if (c.enabled && c.key) {
        cookieParts.push(`${c.key}=${c.value}`)
      }
    }
    if (cookieParts.length > 0) {
      const existing = headers['Cookie'] ? headers['Cookie'] + '; ' : ''
      headers['Cookie'] = existing + cookieParts.join('; ')
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      signal: controller.signal,
      redirect: 'follow'
    }

    // Add body for non-GET/HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body.type !== 'none') {
      switch (request.body.type) {
        case 'json':
          fetchOptions.body = request.body.content
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json'
          }
          break

        case 'text':
          fetchOptions.body = request.body.content
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'text/plain'
          }
          break

        case 'x-www-form-urlencoded': {
          const params = new URLSearchParams()
          for (const item of request.body.formData) {
            if (item.enabled && item.key) params.append(item.key, item.value)
          }
          fetchOptions.body = params.toString()
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
          }
          break
        }

        case 'form-data': {
          // Use Node.js built-in FormData (available in Node 18+)
          const formData = new FormData()
          for (const item of request.body.formData) {
            if (item.enabled && item.key) {
              formData.append(item.key, item.value)
            }
          }
          fetchOptions.body = formData
          // Don't set Content-Type — fetch will set it with the boundary automatically
          delete headers['Content-Type']
          break
        }
      }
    }

    // Build raw HTTP request text
    const urlPath = url.pathname + url.search
    const rawLines: string[] = [`${request.method} ${urlPath} HTTP/1.1`, `Host: ${url.host}`]
    for (const [key, value] of Object.entries(headers)) {
      rawLines.push(`${key}: ${value}`)
    }
    let rawRequest = rawLines.join('\n')
    if (fetchOptions.body != null) {
      if (typeof fetchOptions.body === 'string') {
        rawRequest += '\n\n' + fetchOptions.body
      } else {
        // FormData — boundary is set by fetch, show placeholder
        rawRequest += '\n\n[multipart/form-data body]'
      }
    }

    const res = await fetch(url.toString(), fetchOptions)
    const bodyText = await res.text()
    const elapsed = Date.now() - startTime

    // Collect response headers
    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: bodyText,
      size: new TextEncoder().encode(bodyText).byteLength,
      time: elapsed,
      rawRequest
    }
  } catch (err: any) {
    const elapsed = Date.now() - startTime

    if (err.name === 'AbortError') {
      return {
        status: 0,
        statusText: 'Request timed out',
        headers: {},
        body: 'The request was aborted (30s timeout exceeded)',
        size: 0,
        time: elapsed,
        rawRequest: ''
      }
    }

    // Provide user-friendly error messages for common failures
    let statusText = 'Request failed'
    let body = err.message || 'Unknown error'

    if (err.code === 'ENOTFOUND' || err.cause?.code === 'ENOTFOUND') {
      statusText = 'DNS lookup failed'
      body = `Could not resolve host: ${request.url}`
    } else if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      statusText = 'Connection refused'
      body = `Connection refused: ${request.url}`
    } else if (err.code === 'ECONNRESET' || err.cause?.code === 'ECONNRESET') {
      statusText = 'Connection reset'
      body = 'The connection was reset by the server'
    } else if (err.message?.includes('fetch failed')) {
      statusText = 'Network error'
      body = err.cause?.message || err.message
    }

    return {
      status: 0,
      statusText,
      headers: {},
      body,
      size: 0,
      time: elapsed,
      rawRequest: ''
    }
  } finally {
    clearTimeout(timeout)
    activeRequests.delete(request.id)
  }
}

// --- IPC Handlers ---

function registerIpcHandlers(): void {
  // Send HTTP request from main process (avoids CORS)
  ipcMain.handle(
    IPC_CHANNELS.SEND_REQUEST,
    async (_event, request: RestRequest): Promise<RestResponse> => {
      return executeRequest(request)
    }
  )

  // Cancel an in-flight request
  ipcMain.handle(IPC_CHANNELS.CANCEL_REQUEST, (_event, requestId: string) => {
    const controller = activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      activeRequests.delete(requestId)
    }
  })

  // --- Store: Collections ---
  ipcMain.handle(IPC_CHANNELS.GET_COLLECTIONS, async () => {
    const s = await getStore()
    return s.get('collections', [])
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_COLLECTION, async (_event, collection: Collection) => {
    const s = await getStore()
    const collections: Collection[] = s.get('collections', [])
    const idx = collections.findIndex((c: Collection) => c.id === collection.id)
    if (idx >= 0) {
      collections[idx] = collection
    } else {
      collections.push(collection)
    }
    s.set('collections', collections)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_COLLECTION, async (_event, id: string) => {
    const s = await getStore()
    const collections: Collection[] = s.get('collections', [])
    s.set(
      'collections',
      collections.filter((c: Collection) => c.id !== id)
    )
  })

  // --- Store: History ---
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    const s = await getStore()
    return s.get('history', [])
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_HISTORY_ENTRY, async (_event, entry: HistoryEntry) => {
    const s = await getStore()
    const history: HistoryEntry[] = s.get('history', [])
    history.unshift(entry) // newest first
    // Keep max 100 entries
    if (history.length > 100) history.length = 100
    s.set('history', history)
  })

  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
    const s = await getStore()
    s.set('history', [])
  })
}

// --- App Lifecycle ---

app.whenReady().then(() => {
  // Set Content Security Policy (production only — dev mode needs inline scripts for Vite HMR)
  if (!is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
          ]
        }
      })
    })
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
