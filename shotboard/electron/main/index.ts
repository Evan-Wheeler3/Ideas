import { app, BrowserWindow, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

  // Smoke-test hook: SHOTBOARD_SCREENSHOT=out.png captures the window after load, then quits.
  const shotPath = process.env.SHOTBOARD_SCREENSHOT
  if (shotPath) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
