// File access for the desktop app (Electron, via the preload bridge) and for the browser build
// (download / file picker / IndexedDB). The rest of the app only talks to `platform`.
import type { ShotBoardApi } from '../../electron/preload'

export interface FileRef {
  /** Full path on disk; null in the browser build. */
  path: string | null
  name: string
}

export interface AutosaveEntry extends FileRef {
  data: Uint8Array
  savedAt: number
}

export interface Platform {
  kind: 'electron' | 'web'
  openProject(): Promise<(FileRef & { data: Uint8Array }) | null>
  /** Save to `file.path`, or ask where when there's no path or `saveAs` is set. Returns where it went. */
  saveProject(data: Uint8Array, file: FileRef, saveAs: boolean): Promise<FileRef | null>
  readAutosave(): Promise<AutosaveEntry | null>
  writeAutosave(data: Uint8Array, file: FileRef): Promise<void>
  clearAutosave(): Promise<void>
  setWindowTitle(title: string): void
}

declare global {
  interface Window {
    shotboard?: ShotBoardApi
  }
}

const baseName = (name: string) => name.replace(/\.shotboard$/i, '')
const withExt = (name: string) => `${baseName(name)}.shotboard`

/* ---------------- Electron ---------------- */

function electronPlatform(api: ShotBoardApi): Platform {
  return {
    kind: 'electron',
    openProject: () => api.openProject(),
    saveProject: (data, file, saveAs) => api.saveProject(data, saveAs ? null : file.path, withExt(file.name)),
    readAutosave: () => api.readAutosave(),
    writeAutosave: (data, file) => api.writeAutosave(data, file),
    clearAutosave: () => api.clearAutosave(),
    setWindowTitle: (title) => api.setTitle(title)
  }
}

/* ---------------- Browser ---------------- */

const DB = 'shotboard'
const STORE = 'autosave'

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    }
  })
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

function webPlatform(): Platform {
  return {
    kind: 'web',
    async openProject() {
      const file = await pickFile('.shotboard')
      if (!file) return null
      return { path: null, name: baseName(file.name), data: new Uint8Array(await file.arrayBuffer()) }
    },
    async saveProject(data, file) {
      // Browsers can't write to a chosen path, so saving downloads the file.
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = withExt(file.name)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return { path: null, name: baseName(file.name) }
    },
    readAutosave: () => idb<AutosaveEntry | undefined>('readonly', (s) => s.get('latest')).then((e) => e ?? null),
    async writeAutosave(data, file) {
      await idb('readwrite', (s) => s.put({ ...file, data, savedAt: Date.now() } satisfies AutosaveEntry, 'latest'))
    },
    async clearAutosave() {
      await idb('readwrite', (s) => s.delete('latest'))
    },
    setWindowTitle: (title) => void (document.title = title)
  }
}

export const platform: Platform = window.shotboard ? electronPlatform(window.shotboard) : webPlatform()
