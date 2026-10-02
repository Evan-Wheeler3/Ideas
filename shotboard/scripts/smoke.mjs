// Browser smoke test: starts the renderer with Vite, drives the UI in headless Chromium,
// checks the main features work, and saves screenshots to test-output/.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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

/** A tiny valid .glb (one triangle, 0.5 m to 1.5 m above its origin) to test importing. */
function makeTestGlb(path) {
  const positions = new Float32Array([0, 0.5, 0, 1, 0.5, 0, 0, 1.5, 0])
  const bin = Buffer.from(positions.buffer)
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: 'Tri' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      buffers: [{ byteLength: bin.length }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0.5, 0], max: [1, 1.5, 0] }]
    })
  )
  const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12)
  const total = 12 + 8 + jsonPadded.length + 8 + bin.length
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(total, 8)
  const chunk = (type, data) => {
    const h = Buffer.alloc(8)
    h.writeUInt32LE(data.length, 0)
    h.writeUInt32LE(type, 4)
    return Buffer.concat([h, data])
  }
  writeFileSync(path, Buffer.concat([header, chunk(0x4e4f534a, jsonPadded), chunk(0x004e4942, bin)]))
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

  const rows = () => page.locator('.tree-row:not(.camera-row)').count()
  const selectedName = () => page.locator('.tree-row.selected .tree-name').first().textContent().catch(() => null)
  const field = (rowLabel, i = 0) => page.locator('.prop-row', { hasText: rowLabel }).locator('input').nth(i)
  const canvasBox = await page.locator('.viewport canvas').boundingBox()
  const cx = canvasBox.x + canvasBox.width / 2
  const cy = canvasBox.y + canvasBox.height / 2

  // ---- Milestone 1: editing basics ----
  const start = await rows()
  check(start === 9, `starter scene has 9 objects (got ${start})`)
  check(await page.locator('.obj-label', { hasText: 'Anna' }).isVisible(), 'people have name labels in the 3D view')

  await page.getByRole('button', { name: 'Box', exact: true }).click()
  check((await rows()) === start + 1, 'Add > Box adds an object')
  check((await selectedName()) === 'Box', 'new object is selected')
  check(await page.locator('.dirty-dot').count() === 1, 'unsaved-changes dot appears')

  const posX = field('Position')
  const startX = await posX.inputValue()
  await posX.click()
  await posX.fill('2.5')
  await posX.press('Enter')
  check((await posX.inputValue()) === '2.50', 'typing a position updates the field')
  await page.keyboard.press('Control+z')
  check((await posX.inputValue()) === startX, 'Ctrl+Z undoes the position edit')
  await page.keyboard.press('Control+Shift+z')
  check((await posX.inputValue()) === '2.50', 'Ctrl+Shift+Z redoes it')

  await page.keyboard.press('Control+d')
  check((await rows()) === start + 2, 'Ctrl+D duplicates')
  await page.keyboard.press('Delete')
  check((await rows()) === start + 1, 'Delete removes the selection')

  await page.keyboard.press('e')
  check(await page.locator('.tool-btn.active[title^="Rotate"]').count() === 1, 'E switches to rotate tool')
  await page.keyboard.press('x')
  check(await page.locator('.tool-btn.active[title^="Snap on"]').count() === 1, 'X turns snapping on')
  await page.keyboard.press('w')

  // Click an object in 3D: frame the wall, deselect, click the middle of the view.
  await page.locator('.tree-row', { hasText: 'Wall' }).click()
  await page.keyboard.press('f')
  await page.waitForTimeout(700)
  await page.keyboard.press('Escape')
  await page.mouse.click(cx, cy)
  await page.waitForTimeout(300)
  check((await selectedName()) === 'Wall', 'clicking an object in the viewport selects it')

  // Drag the gizmo's center handle (a box's origin is its middle, so F puts it mid-view).
  await page.locator('.tree-row', { hasText: 'Box' }).click()
  await page.keyboard.press('f')
  await page.waitForTimeout(700)
  const readPos = () => Promise.all([0, 1, 2].map((i) => field('Position', i).inputValue()))
  const beforeDrag = await readPos()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 12, cy + i * 3)
  await page.mouse.up()
  await page.waitForTimeout(300)
  const afterDrag = await readPos()
  check(JSON.stringify(afterDrag) !== JSON.stringify(beforeDrag), `dragging the gizmo moves the object (${beforeDrag} -> ${afterDrag})`)
  check((await selectedName()) === 'Box', 'object stays selected after a drag')
  await page.keyboard.press('Control+z')
  check(JSON.stringify(await readPos()) === JSON.stringify(beforeDrag), 'one Ctrl+Z undoes the whole drag')
  await page.keyboard.press('x')

  // ---- People and poses ----
  await page.locator('.tree-row', { hasText: 'Anna' }).click()
  check(await page.locator('.chip.on', { hasText: 'Sit' }).count() === 1, 'seated person shows the Sit pose')
  await page.locator('.chip', { hasText: 'Walk' }).click()
  check(await page.locator('.chip.on', { hasText: 'Walk' }).count() === 1, 'picking Walk applies the pose')
  await page.locator('.joint-btn', { hasText: 'Left forearm' }).click()
  check(await page.locator('.props-head', { hasText: 'Left forearm' }).count() === 1, 'picking a joint opens joint controls')
  const bendX = field('Bend')
  await bendX.click()
  await bendX.fill('-70')
  await bendX.press('Enter')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/m2-pose.png` })
  await page.keyboard.press('Escape')
  check(await page.locator('.hint-small', { hasText: 'Custom pose' }).count() === 1, 'bending a joint makes the pose custom')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  check(await page.locator('.chip.on', { hasText: 'Sit' }).count() === 1, 'undo restores the original pose')

  // ---- Shot camera and lens ----
  await page.keyboard.press('Escape')
  check(await page.locator('.props-head', { hasText: 'Shot camera' }).count() === 1, 'with nothing selected, Properties shows the camera')
  await page.locator('.chip', { hasText: /^50$/ }).click()
  check((await page.locator('.camera-row .tree-meta').textContent()) === '50mm f/2.8', 'focal length preset applies')
  const fovText = await page.locator('.readout', { hasText: 'Field of view' }).locator('strong').textContent()
  check(fovText.startsWith('28.0°'), `50mm on Super 35 at 2.39 gives a 28.0° horizontal FOV (got ${fovText})`)

  await page.keyboard.press('c')
  await page.waitForTimeout(800)
  check(await page.locator('.ov-hud', { hasText: '50mm' }).isVisible(), 'C switches to camera view with the lens readout')
  const frame = await page.locator('.ov-frame').boundingBox()
  check(Math.abs(frame.width / frame.height - 2.39) < 0.02, `frame is 2.39:1 (got ${(frame.width / frame.height).toFixed(3)})`)
  await page.locator('.ov-select').selectOption('1.78')
  await page.waitForTimeout(300)
  const frame169 = await page.locator('.ov-frame').boundingBox()
  check(Math.abs(frame169.width / frame169.height - 16 / 9) < 0.02, 'changing aspect ratio reshapes the frame')
  await page.keyboard.press('Control+z')

  await page.locator('.prop-row', { hasText: 'Focus on' }).locator('select').selectOption({ label: 'Anna' })
  const focus = Number(await field('Distance').inputValue())
  check(focus > 4 && focus < 7, `Focus on Anna sets a sensible distance (${focus} m)`)
  await page.locator('.chip', { hasText: /^1.4$/ }).click()
  await page.locator('.ov-btn', { hasText: 'DoF' }).click()
  await page.waitForTimeout(1200)
  check(await page.locator('.ov-hud', { hasText: 'Sharp' }).isVisible(), 'depth of field shows the in-focus range')
  await page.screenshot({ path: `${OUT}/m2-camera.png` })

  // Drag in camera view moves the shot camera; one undo puts it back.
  const camPos = () => Promise.all([0, 1, 2].map((i) => field('Position', i).inputValue()))
  const camBefore = await camPos()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(cx - i * 15, cy)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
  const camAfter = await camPos()
  check(JSON.stringify(camAfter) !== JSON.stringify(camBefore), 'dragging in camera view moves the camera')
  check(await page.locator('.props-head', { hasText: 'Shot camera' }).count() === 1, 'releasing a drag over an object does not select it')
  await page.keyboard.press('Control+z')
  const camUndone = await camPos()
  check(JSON.stringify(camUndone) === JSON.stringify(camBefore), `undo restores the camera move (${camBefore} -> ${camAfter} -> ${camUndone}) [${await page.locator('.tool-btn').first().getAttribute('title')}]`)

  // F in camera view aims the camera at the selected object.
  await page.locator('.tree-row', { hasText: 'Ben' }).click()
  await page.keyboard.press('f')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  const pan = await field('Angle', 1).inputValue()
  check(pan !== '5.5°', `F aims the camera at the selection (pan now ${pan})`)

  await page.keyboard.press('c')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Camera from view' }).click()
  const fromView = await camPos()
  check(fromView[0] !== camBefore[0] || fromView[2] !== camBefore[2], `Camera from view moves the camera to the editor view (${fromView})`)
  await page.keyboard.press('Control+z')

  // ---- Import a model ----
  makeTestGlb(`${OUT}/tri.glb`)
  await page.locator('input[type=file]').setInputFiles(`${OUT}/tri.glb`)
  await page.waitForTimeout(800)
  check((await selectedName()) === 'tri', 'importing a .glb adds it and selects it')
  check((await field('Position', 1).inputValue()) === '-0.50', 'imported model is placed on the floor')
  check(await page.locator('.add-section-title', { hasText: 'Imported' }).count() === 1, 'Add panel lists imported models')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/m2-editor.png` })

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
} catch (e) {
  console.error(e)
  failed = true
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
