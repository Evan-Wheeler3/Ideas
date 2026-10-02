// File handling for the renderer: open/save dialogs, safe writes, and autosave.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { startSidecar } from './sidecar'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

const FILTERS = [{ name: 'ShotBoard project', extensions: ['shotboard'] }]

interface FileRef {
  path: string | null
  name: string
}

const nameOf = (path: string) => basename(path, extname(path))
const autosaveDir = () => join(app.getPath('userData'), 'autosave')

/**
 * Write without ever leaving a half-written project: keep the previous save as `<file>.bak`,
 * write to a temp file next to the target, then rename it into place.
 */
async function safeWrite(path: string, data: Uint8Array): Promise<void> {
  const exists = await stat(path).then(() => true, () => false)
  if (exists) await copyFile(path, `${path}.bak`)
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`)
  await writeFile(tmp, data)
  await rename(tmp, path)
}

export function registerIpc(): void {
  ipcMain.handle('project:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const res = await dialog.showOpenDialog(win, { title: 'Open project', filters: FILTERS, properties: ['openFile'] })
    if (res.canceled || !res.filePaths[0]) return null
    const path = res.filePaths[0]
    return { path, name: nameOf(path), data: new Uint8Array(await readFile(path)) }
  })

  ipcMain.handle('project:save', async (e, data: Uint8Array, path: string | null, suggestedName: string) => {
    let target = path
    if (!target) {
      const win = BrowserWindow.fromWebContents(e.sender)!
      const res = await dialog.showSaveDialog(win, {
        title: 'Save project',
        defaultPath: join(app.getPath('documents'), suggestedName),
        filters: FILTERS
      })
      if (res.canceled || !res.filePath) return null
      target = extname(res.filePath) ? res.filePath : `${res.filePath}.shotboard`
    }
    await safeWrite(target, data)
    return { path: target, name: nameOf(target) } satisfies FileRef
  })

  ipcMain.handle('autosave:write', async (_e, data: Uint8Array, file: FileRef) => {
    await mkdir(autosaveDir(), { recursive: true })
    await safeWrite(join(autosaveDir(), 'latest.shotboard'), data)
    await writeFile(join(autosaveDir(), 'latest.json'), JSON.stringify({ ...file, savedAt: Date.now() }))
  })

  ipcMain.handle('autosave:read', async () => {
    try {
      const meta = JSON.parse(await readFile(join(autosaveDir(), 'latest.json'), 'utf8')) as FileRef & { savedAt: number }
      const data = new Uint8Array(await readFile(join(autosaveDir(), 'latest.shotboard')))
      return { ...meta, data }
    } catch {
      return null
    }
  })

  ipcMain.handle('autosave:clear', async () => {
    await rm(autosaveDir(), { recursive: true, force: true })
  })

  ipcMain.handle('sidecar:info', () => startSidecar())

  // Save an exported file (PDF, MP4, ZIP) where the user chooses.
  ipcMain.handle('file:save', async (e, data: Uint8Array, suggestedName: string, kind: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const filters = {
      pdf: [{ name: 'PDF', extensions: ['pdf'] }],
      mp4: [{ name: 'MP4 video', extensions: ['mp4'] }],
      zip: [{ name: 'ZIP archive', extensions: ['zip'] }]
    }[kind] ?? []
    const res = await dialog.showSaveDialog(win, { title: 'Export', defaultPath: join(app.getPath('documents'), suggestedName), filters })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, data)
    return res.filePath
  })

  ipcMain.handle('file:reveal', (_e, path: string) => shell.showItemInFolder(path))

  ipcMain.on('window:title', (e, title: string) => {
    BrowserWindow.fromWebContents(e.sender)?.setTitle(title)
  })
}
