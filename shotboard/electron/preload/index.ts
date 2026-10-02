import { contextBridge, ipcRenderer } from 'electron'

interface FileRef {
  path: string | null
  name: string
}

// The renderer's only door to the desktop. Each call maps to a handler in electron/main/ipc.ts.
const api = {
  platform: process.platform,
  isElectron: true as const,
  openProject: (): Promise<(FileRef & { data: Uint8Array }) | null> => ipcRenderer.invoke('project:open'),
  saveProject: (data: Uint8Array, path: string | null, suggestedName: string): Promise<FileRef | null> =>
    ipcRenderer.invoke('project:save', data, path, suggestedName),
  readAutosave: (): Promise<(FileRef & { data: Uint8Array; savedAt: number }) | null> => ipcRenderer.invoke('autosave:read'),
  writeAutosave: (data: Uint8Array, file: FileRef): Promise<void> => ipcRenderer.invoke('autosave:write', data, file),
  clearAutosave: (): Promise<void> => ipcRenderer.invoke('autosave:clear'),
  setTitle: (title: string): void => ipcRenderer.send('window:title', title)
}

contextBridge.exposeInMainWorld('shotboard', api)

export type ShotBoardApi = typeof api
