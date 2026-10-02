// Browser smoke test: starts the renderer with Vite, drives the UI in headless Chromium,
// checks the main features work, and saves screenshots to test-output/.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('samples', { recursive: true })
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5199/?autosaveMs=1500'
const OUT = 'test-output'
mkdirSync(OUT, { recursive: true })

// Own process group, so stopping it also stops the Vite process npx starts.
const server = spawn('npx', ['vite', '--config', 'vite.web.config.ts'], { stdio: 'pipe', detached: true })
const stop = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {}
}

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
  // Leaving with unsaved changes asks "are you sure?"; accept so reloads go through.
  page.on('dialog', (d) => d.accept())

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


  // ---- Milestone 3: shots ----
  const cards = page.locator('.shot-card:not(.add-card)')
  const cardLens = (i) => cards.nth(i).locator('.shot-meta .mono').textContent()
  check((await cards.count()) === 1, 'project starts with one shot')
  await page.waitForSelector('.shot-card img', { timeout: 20000 })
  check(true, 'shot thumbnail renders from the shot camera')

  await page.keyboard.press('n')
  check((await cards.count()) === 2, 'N adds a shot')
  check((await page.locator('.shot-card.active .shot-badge').textContent()) === '2', 'the new shot becomes the current shot')
  const lens1 = await cardLens(0)
  await page.locator('.chip', { hasText: /^85$/ }).click()
  check((await cardLens(1)).startsWith('85mm') && (await cardLens(0)) === lens1, 'shots are independent (changing shot 2 leaves shot 1 alone)')
  const thumb2Before = await cards.nth(1).locator('img').getAttribute('src')
  await page.waitForFunction(
    (before) => document.querySelectorAll('.shot-card:not(.add-card)')[1]?.querySelector('img')?.getAttribute('src') !== before,
    thumb2Before,
    { timeout: 20000 }
  )
  check(true, 'thumbnail refreshes after the shot changes')

  await cards.nth(0).hover()
  await cards.nth(0).locator('[title="Duplicate shot"]').click()
  check((await cards.count()) === 3, 'duplicate shot')
  const badges = async () => (await page.locator('.shot-badge').allTextContents()).join(',')
  check((await badges()) === '1,2,3', `shots are numbered in order (${await badges()})`)
  await cards.nth(2).hover()
  await cards.nth(2).locator('[title="Delete shot"]').click()
  check((await cards.count()) === 2, 'delete shot')
  await page.keyboard.press('Control+z')
  check((await cards.count()) === 3, 'undo brings the deleted shot back')

  // Drag the last shot to the front.
  const lastLens = await cardLens(2)
  await cards.nth(2).dragTo(cards.nth(0), { targetPosition: { x: 10, y: 40 } })
  check((await cardLens(0)) === lastLens && (await badges()) === '1,2,3', 'drag to reorder (numbers follow the new order)')

  await page.locator('.shot-card').nth(0).click()
  await page.keyboard.press(']')
  check((await page.locator('.shot-card.active .shot-badge').textContent()) === '2', '] goes to the next shot')
  await page.keyboard.press('[')
  check((await page.locator('.shot-card.active .shot-badge').textContent()) === '1', '[ goes to the previous shot')

  // Shot details in Properties (nothing selected).
  await page.keyboard.press('Escape')
  const notes = page.locator('.prop-stack textarea')
  await notes.fill('Anna waits by the window.')
  await notes.blur()
  check((await cards.nth(0).locator('.shot-notes').textContent()) === 'Anna waits by the window.', 'notes typed in Properties show on the card')

  // List view, custom column, custom number.
  await page.locator('[title="Shot list table"]').click()
  const rowsT = page.locator('.shot-row:not(.head)')
  check((await rowsT.count()) === 3, 'list view shows every shot')
  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.locator('.columns-menu input[placeholder^="Name"]').fill('Location')
  await page.locator('.columns-menu').getByRole('button', { name: 'Add column' }).click()
  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  check(await page.locator('.shot-row.head', { hasText: 'Location' }).count() === 1, 'adding a column shows it in the table')
  const locCell = rowsT.nth(1).locator('.cell').last().locator('input')
  await locCell.fill('INT. DINER')
  await locCell.press('Enter')
  const numCell = rowsT.nth(2).locator('.num-input')
  await numCell.fill('2A')
  await numCell.press('Enter')
  check((await rowsT.nth(2).locator('.num-input').inputValue()) === '2A', 'shots can be given their own number')

  // Undo of an edit on another shot jumps back to that shot.
  await rowsT.nth(0).locator('.drag-handle').click()
  await page.keyboard.press('Control+z')
  check((await rowsT.nth(2).locator('.num-input').inputValue()) === '3', 'undo reverts the number')
  check((await page.locator('.shot-row.active .num-input').inputValue()) === '3', 'undo switches to the shot it changed')
  await page.keyboard.press('Control+Shift+z')
  await page.screenshot({ path: `${OUT}/m3-list.png` })
  await page.locator('[title="Storyboard grid"]').click()

  // ---- Saving and opening ----
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')])
  const savedPath = `${OUT}/smoke.shotboard`
  await download.saveAs(savedPath)
  check(download.suggestedFilename() === 'Untitled.shotboard', `Ctrl+S saves a .shotboard file (${download.suggestedFilename()})`)
  check(await page.locator('.dirty-dot').count() === 0, 'saving clears the unsaved-changes dot')

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sphere', exact: true }).click()
  await page.locator('.file-btn').click()
  await page.locator('.menu-item', { hasText: 'Open…' }).click()
  check(await page.locator('.modal', { hasText: 'Unsaved changes' }).isVisible(), 'opening with unsaved changes asks first')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.modal .btn.primary').click()])
  await chooser.setFiles(savedPath)
  await page.waitForSelector('.toast', { hasText: 'Opened' })
  check((await cards.count()) === 3, 'the saved project opens with all its shots')
  check(await page.locator('.tree-row', { hasText: 'Sphere' }).count() === 0, 'unsaved changes were discarded')
  check((await page.locator('.shot-card img').count()) === 3, 'thumbnails are stored in the file')
  check((await page.locator('.shot-badge').allTextContents()).includes('2A'), 'custom shot numbers are saved')

  // ---- Sample project ----
  await page.locator('.file-btn').click()
  await page.locator('.menu-item', { hasText: 'Open sample project' }).click()
  check((await cards.count()) === 6, 'sample project has 6 shots')
  // Generous: software rendering in CI draws two canvases at once and is slow.
  await page.waitForFunction(() => document.querySelectorAll('.shot-card img').length === 6, null, { timeout: 180000 })
  check(true, 'thumbnails render for every shot, not just the current one')
  await page.keyboard.press('c')
  await page.locator('.shot-card').nth(3).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/m3-sample.png` })
  await page.keyboard.press('c')
  // Refresh samples/Diner-Scene.shotboard only when asked (it gets new random ids every time).
  if (process.env.UPDATE_SAMPLE) {
    const [sampleDl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')])
    await sampleDl.saveAs('samples/Diner-Scene.shotboard')
  }

  // ---- Autosave and recovery ----
  const title = page.locator('.title-input')
  await title.fill('Autosave test')
  await title.press('Enter')
  await page.waitForTimeout(3500)
  await page.reload()
  await page.waitForSelector('.modal', { timeout: 60000 })
  check(await page.locator('.modal', { hasText: 'Recover unsaved work' }).isVisible(), 'after a crash/reload, recovery is offered')
  await page.locator('.modal .btn.primary').click()
  await page.waitForTimeout(500)
  check((await title.inputValue()) === 'Autosave test', 'recovering brings back the unsaved work')
  check((await cards.count()) === 6, 'recovered project has all its shots')
  check(await page.locator('.dirty-dot').count() === 1, 'recovered work is marked unsaved')

  await page.locator('.file-btn').click()
  await page.locator('.menu-item', { hasText: 'New project' }).click()
  await page.locator('.modal .btn.primary').click()
  check((await cards.count()) === 1 && (await page.locator('.tree-row', { hasText: 'Person' }).count()) === 1, 'New project starts a clean stage')

  // ---- Milestone 4: camera moves and playback ----
  await page.locator('.file-btn').click()
  await page.locator('.menu-item', { hasText: 'Open sample project' }).click()
  const keysOnTrack = () => page.locator('.tl-key').count()
  const playheadText = async () => Number(await page.locator('.tl-time strong').textContent())
  await cards.nth(1).click()
  await page.keyboard.press('Escape')
  check(await page.locator('.tl-empty').isVisible(), 'a shot with no move says how to add one')

  await page.locator('.tl-btn', { hasText: 'Moves' }).click()
  await page.locator('.move-btn', { hasText: 'Dolly in' }).click()
  check((await keysOnTrack()) === 2, 'Dolly in preset adds a start and an end key')
  check(await cards.nth(1).locator('.shot-flag').count() === 1, 'the shot card shows it has a camera move')
  await page.keyboard.press('Home')
  const zStart = await field('Position', 2).inputValue()
  await page.keyboard.press('End')
  const zEnd = await field('Position', 2).inputValue()
  check(Number(zEnd) < Number(zStart) - 1, `scrubbing to the end shows the camera dollied in (z ${zStart} -> ${zEnd})`)
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  check(Math.abs((await playheadText()) - 1 / 24) < 0.01, 'arrow keys step one frame')

  // Scrub to the middle and add a key; then change the lens there (updates that key, no new one).
  const trackBox = await page.locator('.tl-track').boundingBox()
  await page.mouse.click(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height - 6)
  const mid = await playheadText()
  check(Math.abs(mid - 2.5) < 0.1, `clicking the timeline scrubs (playhead ${mid}s)`)
  await page.keyboard.press('k')
  check((await keysOnTrack()) === 3, 'K adds a key at the playhead')
  check(await page.locator('.key-tools').isVisible(), 'the new key is selected, with its easing shown')
  await page.locator('.chip', { hasText: /^85$/ }).click()
  check((await keysOnTrack()) === 3, 'changing the lens on a key updates that key')
  await page.locator('.key-tools select').selectOption('linear')
  check((await page.locator('.key-tools select').inputValue()) === 'linear', 'key easing can be changed')

  // Auto-key: at a new time, changing the camera adds a key.
  await page.mouse.click(trackBox.x + trackBox.width * 0.25, trackBox.y + trackBox.height - 6)
  await page.locator('.chip', { hasText: /^50$/ }).click()
  check((await keysOnTrack()) === 4, 'changing the camera at a new time adds a key (auto-key)')

  // Drag a key to a new time.
  const key = page.locator('.tl-key').nth(2)
  const kb = await key.boundingBox()
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(kb.x + kb.width / 2 + i * 10, kb.y + kb.height / 2)
  await page.mouse.up()
  const keyTime = Number((await page.locator('.key-tools .mono').textContent()).replace('s', ''))
  check(keyTime > 2.6, `dragging a key moves it in time (now ${keyTime}s)`)
  await page.keyboard.press('Delete')
  check((await keysOnTrack()) === 3, 'Delete removes the selected key')

  await page.locator('.tl-select select').selectOption({ label: 'Rough' })
  check(await cards.nth(1).locator('.shot-flag').count() === 2, 'handheld shake is shown on the card')

  // Play the shot.
  await page.keyboard.press('c')
  await page.keyboard.press('Home')
  // Loop, so the shot is still playing when checked even if software rendering is slow.
  await page.locator('.tl-btn[title="Loop"]').click()
  await page.keyboard.press(' ')
  // Wait for the playhead to move (software rendering in CI can be slow to draw frames).
  await page.waitForFunction(() => Number(document.querySelector('.tl-time strong')?.textContent) > 0.3, null, { timeout: 15000 }).catch(() => {})
  const during = await playheadText()
  check(during > 0.5, `Space plays the shot (playhead at ${during}s)`)
  check(await page.locator('.hud-time.playing').isVisible(), 'the camera view shows running time while playing')
  await page.screenshot({ path: `${OUT}/m4-playing.png` })
  await page.keyboard.press(' ')
  await page.waitForTimeout(300)
  const paused = await playheadText()
  await page.waitForTimeout(800)
  const isPlaying = () => page.evaluate(() => window.__shotboard.getState().playing)
  check((await playheadText()) === paused && !(await isPlaying()), 'Space pauses')
  await page.locator('.tl-btn[title="Loop"]').click()

  await page.locator('.tl-btn', { hasText: 'Clear move' }).click()
  check((await keysOnTrack()) === 0, 'Clear move removes all keys')
  await page.keyboard.press('Control+z')
  check((await keysOnTrack()) === 3, 'undo brings the move back')

  // Play the whole sequence as an animatic.
  await page.keyboard.press('Shift+ ')
  check((await page.locator('.shot-card.active .shot-badge').textContent()) === '1', 'Play all starts from shot 1')
  await page.waitForFunction(() => document.querySelector('.shot-card.active .shot-badge')?.textContent !== '1', null, { timeout: 20000 }).catch(() => {})
  const shotNow = Number(await page.locator('.shot-card.active .shot-badge').textContent())
  check(shotNow >= 2, `the animatic cuts to the next shots (now on shot ${shotNow})`)
  await page.keyboard.press('Escape')
  check(await page.locator('.tl-btn.on', { hasText: 'All' }).count() === 0, 'Esc stops playback')
  await page.keyboard.press('c')
  await page.locator('.shot-card').nth(1).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/m4-editor.png` })

  // ---- Milestone 5: lighting ----
  const lightRows = () => page.locator('.tree-row', { has: page.locator('.tree-icon') }).filter({ hasText: /light|Practical|Moonlight|Spot/ }).count()
  const lightsGroup = async () => {
    const g = page.locator('.tree-group', { hasText: 'Lights' })
    return (await g.count()) ? Number(await g.locator('span').textContent()) : 0
  }
  await page.keyboard.press('Escape')
  check(await page.locator('.section-title', { hasText: 'Lighting' }).isVisible(), 'with nothing selected, Properties shows Lighting')
  await page.locator('.chip', { hasText: '3-point' }).click()
  check((await lightsGroup()) === 3, '3-point preset adds key, fill and back lights')
  check((await page.locator('.prop-row', { hasText: 'Setting' }).locator('select').inputValue()) === 'stage', '3-point uses the dark stage')
  await page.locator('.chip', { hasText: 'Night' }).click()
  check((await lightsGroup()) === 2, 'Night replaces the preset lights instead of adding more')
  await page.keyboard.press('Control+z')
  check((await lightsGroup()) === 3, 'undo brings back the previous lighting')
  await page.locator('.prop-row', { hasText: 'Setting' }).locator('select').selectOption('day')
  check(await page.locator('.seg-small.text button.on', { hasText: 'Sky' }).count() === 1, 'Day setting shows a sky')
  const ev = field('Exposure')
  await ev.click()
  await ev.fill('0.5')
  await ev.press('Enter')
  check((await ev.inputValue()) === '0.5', 'exposure can be set')
  await page.getByRole('button', { name: 'Use this lighting in all shots' }).click()
  await page.waitForSelector('.toast', { hasText: 'Lighting copied' })
  await cards.nth(4).click()
  await page.keyboard.press('Escape')
  check((await lightsGroup()) === 3 && (await ev.inputValue()) === '0.5', 'lighting copied to the other shots')

  await page.getByRole('button', { name: 'Spot', exact: true }).click()
  check(await page.locator('.section-title', { hasText: 'Light' }).first().isVisible(), 'adding a spot light shows its light settings')
  await page.locator('.chip', { hasText: 'Daylight' }).click()
  check((await field('Colour temp').inputValue()) === '5600', 'colour temperature presets apply')
  const bright = field('Brightness')
  await bright.click()
  await bright.fill('7')
  await bright.press('Enter')
  check((await bright.inputValue()) === '7.0', 'light brightness can be changed')
  await page.keyboard.press('Escape')

  await page.locator('.ov-btn', { hasText: 'AO' }).click()
  check(!(await page.evaluate(() => window.__shotboard.getState().ao)), 'ambient occlusion can be turned off')
  await page.locator('.ov-btn', { hasText: 'AO' }).click()

  await page.keyboard.press('?')
  check(await page.locator('.modal.shortcuts').isVisible(), '? opens the keyboard shortcut sheet')
  await page.keyboard.press('Escape')
  check(await page.locator('.modal.shortcuts').count() === 0, 'Esc closes it')

  await cards.nth(1).click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('c')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/m5-camera.png` })
  await page.keyboard.press('c')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/m5-editor.png` })

  // ---- Milestone 6: export dialog (the full exports run in npm run test:export) ----
  await page.keyboard.press('Control+e')
  check(await page.locator('.export-modal').isVisible(), 'Ctrl+E opens the export dialog')
  await page.waitForSelector('.helper-status.ok, .helper-status.bad', { timeout: 15000 })
  check(await page.locator('.export-card').count() === 3, 'it offers PDF, stills and MP4')
  await page.keyboard.press('Escape')
  check(await page.locator('.export-modal').count() === 0, 'Esc closes the export dialog')

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
} catch (e) {
  console.error(e)
  failed = true
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
