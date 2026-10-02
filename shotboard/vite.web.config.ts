// Runs the renderer alone in a normal browser. Used for smoke tests and quick UI work.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src',
  plugins: [react()],
  server: { port: 5199, strictPort: true }
})
