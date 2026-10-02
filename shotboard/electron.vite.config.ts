import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict content policy for the built app only. Dev mode skips it because hot reload injects inline scripts.
const CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
  "worker-src 'self' blob:; connect-src 'self' http://127.0.0.1:* data: blob:"

const cspPlugin = (): Plugin => ({
  name: 'shotboard-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
})

export default defineConfig({
  main: {
    build: { rollupOptions: { input: resolve(__dirname, 'electron/main/index.ts') } }
  },
  preload: {
    build: { rollupOptions: { input: resolve(__dirname, 'electron/preload/index.ts') } }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    plugins: [react(), cspPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/index.html') } }
  }
})
