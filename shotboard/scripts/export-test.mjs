// End-to-end export test: starts the export helper and the renderer, opens the sample project and
// exports a PDF, stills and an MP4 animatic, then checks the files. Run: npm run test:export
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import JSZip from 'jszip'

const OUT = 'test-output/export'
mkdirSync(OUT, { recursive: true })
const PORT = '8799'
const procs = [
  spawn('node', ['scripts/server.mjs'], { stdio: 'ignore', detached: true, env: { ...process.env, SHOTBOARD_PORT: PORT } }),
  spawn('npx', ['vite', '--config', 'vite.web.config.ts'], { stdio: 'ignore', detached: true })
]
const stop = () => procs.forEach((p) => { try { process.kill(-p.pid) } catch {} })

let failed = false
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failed = true
}

try {
  await new Promise((r) => setTimeout(r, 4000))
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`http://localhost:5199/?sidecar=http://127.0.0.1:${PORT}&token=dev`)
  await page.waitForTimeout(2000)
  await page.locator('.file-btn').click()
  await page.locator('.menu-item', { hasText: 'Open sample project' }).click()
  await page.keyboard.press('Control+e')
  await page.waitForSelector('.helper-status.ok', { timeout: 15000 })
  check(true, 'export dialog finds the helper')

  const grab = async (button, file) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 900000 }), page.getByRole('button', { name: button }).click()])
    await dl.saveAs(`${OUT}/${file}`)
    return dl.suggestedFilename()
  }

  const pdfName = await grab('Export PDF', 'shotlist.pdf')
  check(pdfName === 'Diner Scene - shot list.pdf', `PDF file name (${pdfName})`)
  const pdfInfo = execFileSync('pdfinfo', [`${OUT}/shotlist.pdf`]).toString()
  check(/Pages:\s+1/.test(pdfInfo) && /Title:\s+Diner Scene/.test(pdfInfo), 'PDF has one storyboard page titled with the project')

  const zipName = await grab('Export stills', 'stills.zip')
  const zip = await JSZip.loadAsync(readFileSync(`${OUT}/stills.zip`))
  const pngs = Object.keys(zip.files).filter((f) => f.endsWith('.png'))
  check(zipName === 'Diner Scene - stills.zip' && pngs.length === 6, `stills zip has one PNG per shot (${pngs.length})`)

  // Keep the animatic short for software rendering: 0.5 s per shot.
  await page.evaluate(() => {
    const st = window.__shotboard.getState()
    window.__shotboard.setState({ project: { ...st.project, shots: st.project.shots.map((s) => ({ ...s, duration: 0.5 })) } })
  })
  await page.locator('.seg-small.text button', { hasText: 'Draft' }).click()
  const mp4Name = await grab('Export MP4', 'animatic.mp4')
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=nb_read_frames,width,height:format=duration', '-of', 'json', `${OUT}/animatic.mp4`]).toString()
  )
  const st = probe.streams[0]
  check(mp4Name === 'Diner Scene - animatic.mp4', `MP4 file name (${mp4Name})`)
  check(Number(st.nb_read_frames) === 72, `MP4 has every frame: 6 shots × 0.5 s × 24 fps = 72 (got ${st.nb_read_frames})`)
  check(Math.abs(Number(probe.format.duration) - 3) < 1 / 24, `MP4 length matches the shots (${probe.format.duration}s)`)
  check(st.width === 960 && st.height === 402, `MP4 size (${st.width}×${st.height})`)
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
} catch (e) {
  console.error(e)
  failed = true
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
