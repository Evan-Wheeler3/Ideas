// Browser smoke test: starts the renderer with Vite, drives the UI in headless Chromium,
// checks the basics work, and saves screenshots to test-output/.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5199/'
const OUT = 'test-output'
mkdirSync(OUT, { recursive: true })

const server = spawn('npx', ['vite', '--config', 'vite.web.config.ts'], { stdio: 'pipe' })
const stop = () => server.kill('SIGTERM')

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Vite did not start')
}

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

let failed = false
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failed = true
}

try {
  await waitForServer()
  const browser = await chromium.launch({
    executablePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))

  await page.goto(URL)
  await page.waitForSelector('canvas')
  await page.waitForTimeout(2500)

  const rows = () => page.locator('.tree-row').count()
  const start = await rows()
  check(start === 4, `starter scene has 4 objects (got ${start})`)

  await page.getByRole('button', { name: 'Box' }).click()
  check((await rows()) === start + 1, 'Add > Box adds an object')
  check(await page.locator('.tree-row.selected').count() === 1, 'new object is selected')
  check(await page.locator('.dirty-dot').count() === 1, 'unsaved-changes dot appears')

  // Edit position through the properties panel.
  const posX = page.locator('.prop-row', { hasText: 'Position' }).locator('input').first()
  await posX.click()
  await posX.fill('2.5')
  await posX.press('Enter')
  check((await posX.inputValue()) === '2.50', 'typing a position updates the field')

  await page.keyboard.press('Control+z')
  check((await posX.inputValue()) === '0.00', 'Ctrl+Z undoes the position edit')
  await page.keyboard.press('Control+Shift+z')
  check((await posX.inputValue()) === '2.50', 'Ctrl+Shift+Z redoes it')

  await page.keyboard.press('Control+d')
  check((await rows()) === start + 2, 'Ctrl+D duplicates')
  await page.keyboard.press('Delete')
  check((await rows()) === start + 1, 'Delete removes the selection')

  // Select the table by clicking the scene list, switch to rotate, enable snapping.
  await page.locator('.tree-row', { hasText: 'Table' }).click()
  await page.keyboard.press('e')
  check(await page.locator('.tool-btn.active[title^="Rotate"]').count() === 1, 'E switches to rotate tool')
  await page.keyboard.press('x')
  check(await page.locator('.tool-btn.active[title^="Snap on"]').count() === 1, 'X turns snapping on')
  await page.keyboard.press('w')
  await page.keyboard.press('f')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/m1-selected.png` })

  // Click empty viewport space to deselect, then click an object in 3D to select it.
  await page.keyboard.press('Escape')
  await page.locator('.tree-row', { hasText: 'Lamp' }).click()
  await page.keyboard.press('f')
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  const box = await page.locator('.viewport canvas').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(300)
  const selectedName = await page.locator('.tree-row.selected .tree-name').first().textContent().catch(() => null)
  check(selectedName === 'Lamp', `clicking an object in the viewport selects it (got ${selectedName})`)

  await page.locator('.tree-row', { hasText: 'Table' }).click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('f')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/m1-overview.png` })

  // Drag the gizmo's center handle (framed at the canvas center) and check it commits one undo step.
  await page.locator('.tree-row', { hasText: 'Stool' }).click()
  await page.keyboard.press('f')
  await page.waitForTimeout(800)
  const posFields = page.locator('.prop-row', { hasText: 'Position' }).locator('input')
  const readPos = async () => Promise.all([0, 1, 2].map((i) => posFields.nth(i).inputValue()))
  const beforeDrag = await readPos()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 12, cy + i * 3)
  await page.mouse.up()
  await page.waitForTimeout(300)
  const afterDrag = await readPos()
  check(JSON.stringify(afterDrag) !== JSON.stringify(beforeDrag), `dragging the gizmo moves the object (${beforeDrag} -> ${afterDrag})`)
  check((await page.locator('.tree-row.selected .tree-name').first().textContent()) === 'Stool', 'object stays selected after a drag')
  await page.keyboard.press('Control+z')
  check(JSON.stringify(await readPos()) === JSON.stringify(beforeDrag), 'one Ctrl+Z undoes the whole drag')

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
} catch (e) {
  console.error(e)
  failed = true
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
