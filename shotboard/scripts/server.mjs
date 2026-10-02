// Start the export helper for the browser build: http://127.0.0.1:8765, token "dev". With --pytest, run its tests.
// (The desktop app starts its own copy automatically with a random port and token.)
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'server')
const venv = process.platform === 'win32' ? join(dir, '.venv', 'Scripts', 'python.exe') : join(dir, '.venv', 'bin', 'python')
const python = process.env.SHOTBOARD_PYTHON ?? (existsSync(venv) ? venv : process.platform === 'win32' ? 'python' : 'python3')
const port = process.env.SHOTBOARD_PORT ?? '8765'

// `--pytest` runs the helper's tests with the same Python instead of starting it.
const args = process.argv.includes('--pytest') ? ['-m', 'pytest', '-q'] : ['-m', 'shotboard_server', '--port', port, '--token', 'dev']
const child = spawn(python, args, { cwd: dir, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
