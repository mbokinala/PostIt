import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../types/ipc'
import type { ElectronAPI, RestRequest, Collection, HistoryEntry } from '../types/ipc'

const api: ElectronAPI = {
  sendRequest: (request: RestRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_REQUEST, request),

  cancelRequest: (requestId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_REQUEST, requestId),

  getCollections: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_COLLECTIONS),

  saveCollection: (collection: Collection) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_COLLECTION, collection),

  deleteCollection: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_COLLECTION, id),

  getHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),

  saveHistoryEntry: (entry: HistoryEntry) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_HISTORY_ENTRY, entry),

  clearHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY)
}

contextBridge.exposeInMainWorld('api', api)
