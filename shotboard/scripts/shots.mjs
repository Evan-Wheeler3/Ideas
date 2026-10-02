// Dev helper: open the UI in headless Chromium and save a few screenshots. Usage: node scripts/shots.mjs <outdir>
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const out = process.argv[2] ?? 'test-output'
mkdirSync(out, { recursive: true })
const server = spawn('npx', ['vite', '--config', 'vite.web.config.ts'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 3000))
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
})
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()))
await page.goto('http://localhost:5199/')
await page.waitForTimeout(3000)
await page.screenshot({ path: `${out}/1-editor.png` })
await page.locator('.tree-row', { hasText: 'Anna' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/2-person.png` })
await page.keyboard.press('Escape')
await page.keyboard.press('c')
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/3-camera.png` })
await page.locator('.ov-btn', { hasText: 'DoF' }).click()
await page.locator('.chip', { hasText: /^50$/ }).click()
await page.locator('.chip', { hasText: /^1.4$/ }).click()
await page.locator('.prop-row', { hasText: 'Focus on' }).locator('select').selectOption({ label: 'Anna' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/4-camera-dof.png` })
await browser.close()
server.kill()
