# REST Client - Architecture

## Project Structure

```
rest-client/
├── electron.vite.config.ts     # Vite config for main, preload, renderer
├── package.json
├── tsconfig.json               # Root TS config (references node + web)
├── tsconfig.node.json          # TS config for main/preload
├── tsconfig.web.json           # TS config for renderer
├── src/
│   ├── types/
│   │   └── ipc.ts              # Shared TypeScript types & IPC channel constants
│   ├── main/
│   │   └── index.ts            # Electron main process (window, IPC handlers, HTTP)
│   ├── preload/
│   │   └── index.ts            # contextBridge exposing typed API to renderer
│   └── renderer/
│       ├── index.html          # HTML entry
│       └── src/
│           ├── main.tsx        # React entry point
│           ├── index.css       # Tailwind CSS entry
│           ├── App.tsx         # Root React component (layout shell)
│           ├── components/     # React UI components
│           ├── stores/
│           │   └── requestStore.ts  # Zustand store for app state
│           └── lib/            # Utility functions
```

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Desktop     | Electron 32                         |
| Bundler     | electron-vite (Vite-based)          |
| Frontend    | React 18 + TypeScript               |
| Styling     | Tailwind CSS v4                     |
| State       | Zustand                             |
| Code Editor | @uiw/react-codemirror              |
| Storage     | electron-store (JSON on disk)       |

## IPC Channels

All IPC communication goes renderer → main via `ipcRenderer.invoke` / `ipcMain.handle`.

| Channel Name                | Direction       | Payload            | Returns           |
|-----------------------------|-----------------|--------------------|-------------------|
| `rest:send-request`         | renderer → main | `RestRequest`      | `RestResponse`    |
| `store:get-collections`     | renderer → main | —                  | `Collection[]`    |
| `store:save-collection`     | renderer → main | `Collection`       | `void`            |
| `store:delete-collection`   | renderer → main | `string` (id)      | `void`            |
| `store:get-history`         | renderer → main | —                  | `HistoryEntry[]`  |
| `store:save-history-entry`  | renderer → main | `HistoryEntry`     | `void`            |
| `store:clear-history`       | renderer → main | —                  | `void`            |

Channel name constants are exported from `src/types/ipc.ts` as `IPC_CHANNELS`.

## Key Data Types (from `src/types/ipc.ts`)

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
type BodyType = 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded'

interface KeyValuePair { id: string; key: string; value: string; enabled: boolean }
interface RequestBody  { type: BodyType; content: string; formData: KeyValuePair[] }

interface RestRequest {
  id: string; name: string; method: HttpMethod; url: string;
  headers: KeyValuePair[]; params: KeyValuePair[]; body: RequestBody;
}

interface RestResponse {
  status: number; statusText: string; headers: Record<string, string>;
  body: string; size: number; time: number;
}

interface HistoryEntry { id: string; request: RestRequest; response: RestResponse; timestamp: number }
interface Collection   { id: string; name: string; requests: RestRequest[] }
```

## State Management

Zustand store at `src/renderer/src/stores/requestStore.ts` manages:
- **activeRequest**: The request currently being edited
- **activeResponse**: Response from the last sent request
- **loading**: Whether a request is in-flight
- **collections**: Saved request collections (synced with electron-store)
- **history**: Request history (synced with electron-store)
- **sidebarTab**: Which sidebar panel is active ('collections' | 'history')

The renderer calls `window.api.*` methods (exposed via preload) which invoke IPC handlers in the main process. The main process handles HTTP requests using Node's built-in `fetch` and persists data via `electron-store`.

## How to Run

```bash
# Install dependencies
npm install

# Start in dev mode (hot-reload for renderer)
npm run dev

# Build for production
npm run build

# Type-check
npm run typecheck
```

## Architecture Decisions

1. **HTTP from main process**: All HTTP requests are made via `fetch` in the Electron main process. This avoids CORS issues entirely and behaves like a native app.

2. **electron-store for persistence**: Simple JSON-based storage on disk. No database needed for a REST client. Collections and history are stored as arrays.

3. **Zustand over Redux**: Lightweight, minimal boilerplate. Single store with typed actions. No providers needed.

4. **Tailwind CSS v4**: Utility-first CSS with the new v4 engine. Uses `@import "tailwindcss"` in CSS.

5. **CodeMirror for editors**: `@uiw/react-codemirror` with language extensions for JSON, XML, and HTML syntax highlighting in request/response bodies.
