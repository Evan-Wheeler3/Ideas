import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'

// Machines without a usable GPU (VMs, CI) fall back to software WebGL instead of failing.
if (process.env.SHOTBOARD_SOFTWARE_GL) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('enable-unsafe-swiftshader')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#141518',
    title: 'ShotBoard',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // The renderer blocks unload while there are unsaved changes; ask the user what to do.
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Discard changes', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'You have unsaved changes.',
      detail: 'Close anyway and lose them? Autosave keeps a copy you can recover next time.'
    })
    if (choice === 0) e.preventDefault()
  })

  // Smoke-test hook: SHOTBOARD_SCREENSHOT=out.png captures the window after load, then quits.
  // With SHOTBOARD_SELFTEST=dir it first saves a project and an autosave through the real IPC.
  const shotPath = process.env.SHOTBOARD_SCREENSHOT
  if (shotPath) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const dir = process.env.SHOTBOARD_SELFTEST
        if (dir) {
          const result = await win.webContents.executeJavaScript(`(async () => {
            const api = window.shotboard
            const data = new Uint8Array([1, 2, 3, 4])
            const saved = await api.saveProject(data, ${JSON.stringify(join(dir, 'selftest.shotboard'))}, 'x.shotboard')
            await api.saveProject(new Uint8Array([5, 6]), saved.path, 'x.shotboard')
            await api.writeAutosave(data, saved)
            const auto = await api.readAutosave()
            await api.clearAutosave()
            const cleared = await api.readAutosave()
            return JSON.stringify({ saved, autoName: auto && auto.name, autoBytes: auto && auto.data.length, cleared })
          })()`)
          console.log('SELFTEST', result)
        }
        writeFileSync(shotPath, (await win.webContents.capturePage()).toPNG())
        app.quit()
      }, 4000)
    })
  }

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Shortcuts are handled inside the app. macOS still needs a menu for Quit and text editing;
// it leaves out Undo/Redo so Cmd+Z reaches the app's own undo.
function setMenu(): void {
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { role: 'windowMenu' }
    ])
  )
}

app.whenReady().then(() => {
  registerIpc()
  setMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
