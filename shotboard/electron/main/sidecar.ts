// Starts and looks after the Python export helper (server/). The renderer asks for its URL and
// token over IPC. The app still works without it; only export is unavailable.
import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type SidecarInfo = { url: string; token: string } | { error: string }

const MAX_RESTARTS = 3
let child: ChildProcess | null = null
let ready: Promise<SidecarInfo> | null = null
let restarts = 0
let quitting = false

function serverDir(): string {
  // Packaged builds ship server/ next to the app; in development it's in the project folder.
  const packaged = join(process.resourcesPath ?? '', 'server')
  return app.isPackaged && existsSync(packaged) ? packaged : join(app.getAppPath(), 'server')
}

/** The project's own virtualenv if setup created one, else whatever python is on PATH. */
function pythonCandidates(dir: string): string[] {
  const fromEnv = process.env.SHOTBOARD_PYTHON
  const venv = process.platform === 'win32' ? join(dir, '.venv', 'Scripts', 'python.exe') : join(dir, '.venv', 'bin', 'python')
  return [fromEnv, existsSync(venv) ? venv : undefined, process.platform === 'win32' ? 'python' : 'python3'].filter(Boolean) as string[]
}

function launch(python: string, dir: string): Promise<SidecarInfo> {
  return new Promise((resolve) => {
    const token = randomBytes(24).toString('base64url')
    const proc = spawn(python, ['-m', 'shotboard_server', '--port', '0', '--token', token], {
      cwd: dir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    let settled = false
    const done = (info: SidecarInfo) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(info)
    }
    const timer = setTimeout(() => done({ error: 'The export helper took too long to start.' }), 20_000)

    proc.stdout?.on('data', (buf: Buffer) => {
      const m = /SHOTBOARD_READY (\{.*\})/.exec(buf.toString())
      if (m) {
        const { port } = JSON.parse(m[1]) as { port: number }
        child = proc
        done({ url: `http://127.0.0.1:${port}`, token })
      }
    })
    proc.stderr?.on('data', (buf: Buffer) => (stderr = (stderr + buf.toString()).slice(-2000)))
    proc.on('error', (e) => done({ error: `Couldn't run ${python}: ${e.message}` }))
    proc.on('exit', (code) => {
      if (!settled) {
        const hint = /No module named/.test(stderr) ? ' Run the setup script to install it.' : ''
        done({ error: `The export helper stopped (code ${code}).${hint}\n${stderr.trim().split('\n').slice(-3).join('\n')}` })
        return
      }
      // It was running and crashed: start it again next time it's needed.
      child = null
      ready = null
      if (!quitting && restarts < MAX_RESTARTS) {
        restarts++
        void startSidecar()
      }
    })
  })
}

export function startSidecar(): Promise<SidecarInfo> {
  if (ready) return ready
  ready = (async () => {
    const dir = serverDir()
    let last: SidecarInfo = { error: 'Python was not found.' }
    for (const python of pythonCandidates(dir)) {
      last = await launch(python, dir)
      if ('url' in last) return last
    }
    ready = null
    return last
  })()
  return ready
}

export function stopSidecar(): void {
  quitting = true
  child?.kill()
  child = null
}
