// The three exports: shot list PDF, PNG stills (zip) and MP4 animatic.
import JSZip from 'jszip'
import { create } from 'zustand'
import type { Shot } from '../shared/types'
import { aspectValue, shotLensLabel } from '../camera/lens'
import { platform, type SidecarInfo } from '../platform'
import { useStore } from '../store/store'
import { typeLabel } from '../components/shotFields'
import { ExportCancelled, renderFrames } from './FrameRenderer'

export type ExportKind = 'pdf' | 'stills' | 'animatic'

interface ExportState {
  running: { kind: ExportKind; label: string; progress: number } | null
  cancelRequested: boolean
}

export const useExport = create<ExportState>(() => ({ running: null, cancelRequested: false }))

const setProgress = (label: string, progress: number) =>
  useExport.setState((s) => (s.running ? { running: { ...s.running, label, progress } } : s))

export const cancelExport = () => useExport.setState({ cancelRequested: true })
const cancelled = () => useExport.getState().cancelRequested

/* ---------------- helpers ---------------- */

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export function frameSize(width: number): { width: number; height: number } {
  const aspect = aspectValue(useStore.getState().project.settings.aspect)
  return { width: even(width), height: even(width / aspect) }
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'ShotBoard'

async function sidecar(): Promise<{ url: string; token: string }> {
  const info: SidecarInfo = await platform.sidecar()
  if ('error' in info) throw new Error(info.error)
  return info
}

async function call(info: { url: string; token: string }, path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${info.url}${path}`, {
    ...init,
    headers: { 'X-ShotBoard-Token': info.token, ...(init.headers ?? {}) }
  })
  if (!r.ok) {
    let detail = `${r.status}`
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      // not JSON
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return r
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const framesFor = (shot: Shot, fps: number) => Math.max(1, Math.round(shot.duration * fps))

/** Run an export with progress, cancel and error reporting. Returns where the file went. */
async function run(kind: ExportKind, work: () => Promise<string | null>): Promise<string | null> {
  if (useExport.getState().running) throw new Error('An export is already running')
  useExport.setState({ running: { kind, label: 'Starting…', progress: 0 }, cancelRequested: false })
  try {
    return await work()
  } catch (e) {
    if (e instanceof ExportCancelled) return null
    throw e
  } finally {
    useExport.setState({ running: null, cancelRequested: false })
  }
}

/* ---------------- PDF ---------------- */

export function exportPdf(layout: 'storyboard' | 'list', pageSize: 'letter' | 'a4'): Promise<string | null> {
  return run('pdf', async () => {
    const info = await sidecar()
    const { project } = useStore.getState()
    const { width, height } = frameSize(960)
    const images: string[] = []
    await renderFrames({
      shots: project.shots,
      width,
      height,
      aspect: project.settings.aspect,
      times: () => [0],
      format: 'image/jpeg',
      quality: 0.88,
      shake: false,
      cancelled,
      onFrame: async (i, _f, blob) => {
        images[i] = await blobToBase64(blob)
        setProgress(`Rendering frame for shot ${project.shots[i].number}`, (0.8 * (i + 1)) / project.shots.length)
      }
    })
    setProgress('Laying out the PDF', 0.85)
    const meta = [project.meta.production, project.meta.director && `Dir. ${project.meta.director}`, project.meta.dp && `DP ${project.meta.dp}`]
    const body = {
      title: project.title,
      subtitle: meta.filter(Boolean).join(' · '),
      layout,
      pageSize,
      aspect: aspectValue(project.settings.aspect),
      columns: project.shotColumns.filter((c) => c.visible).map((c) => ({ id: c.id, label: c.label })),
      shots: project.shots.map((s, i) => ({
        number: s.number,
        type: s.type,
        typeLabel: typeLabel(s.type),
        lens: shotLensLabel(s),
        duration: s.duration,
        notes: s.notes,
        fields: Object.fromEntries(Object.entries(s.fields).map(([k, v]) => [k, String(v)])),
        image: images[i] ?? null
      }))
    }
    const r = await call(info, '/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const pdf = new Uint8Array(await r.arrayBuffer())
    setProgress('Saving', 1)
    return platform.saveExport(pdf, `${safeName(project.title)} – shot list.pdf`, 'pdf')
  })
}

/* ---------------- Stills ---------------- */

export function exportStills(width: number): Promise<string | null> {
  return run('stills', async () => {
    const { project } = useStore.getState()
    const size = frameSize(width)
    const zip = new JSZip()
    const pad = String(project.shots.length).length
    await renderFrames({
      shots: project.shots,
      ...size,
      aspect: project.settings.aspect,
      times: () => [0],
      format: 'image/png',
      shake: false,
      cancelled,
      onFrame: async (i, _f, blob) => {
        const s = project.shots[i]
        zip.file(`Shot ${String(i + 1).padStart(pad, '0')} (${safeName(s.number)}) ${s.type}.png`, blob)
        setProgress(`Rendering shot ${s.number}`, (0.9 * (i + 1)) / project.shots.length)
      }
    })
    setProgress('Packing', 0.95)
    const data = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
    return platform.saveExport(data, `${safeName(project.title)} – stills.zip`, 'zip')
  })
}

/* ---------------- Animatic ---------------- */

export function exportAnimatic(width: number, burnIn: boolean): Promise<string | null> {
  return run('animatic', async () => {
    const info = await sidecar()
    const { project } = useStore.getState()
    const fps = project.settings.fps
    const size = frameSize(width)
    const counts = project.shots.map((s) => framesFor(s, fps))
    const total = counts.reduce((a, b) => a + b, 0)
    const starts = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0))

    const job = (await (
      await call(info, '/animatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          fps,
          ...size,
          burnIn,
          shots: project.shots.map((s, i) => ({ number: s.number, type: s.type, lens: shotLensLabel(s), frames: counts[i] }))
        })
      })
    ).json()) as { id: string }

    try {
      let done = 0
      await renderFrames({
        shots: project.shots,
        ...size,
        aspect: project.settings.aspect,
        times: (shot) => Array.from({ length: framesFor(shot, fps) }, (_, f) => f / fps),
        format: 'image/jpeg',
        quality: 0.92,
        shake: true,
        cancelled,
        onFrame: async (i, f, blob) => {
          await call(info, `/animatic/${job.id}/frames/${starts[i] + f}`, { method: 'PUT', body: blob })
          done++
          setProgress(`Rendering frame ${done} of ${total}`, (0.7 * done) / total)
        }
      })

      await call(info, `/animatic/${job.id}/finish`, { method: 'POST' })
      for (;;) {
        if (cancelled()) throw new ExportCancelled()
        const st = (await (await call(info, `/jobs/${job.id}`)).json()) as { state: string; progress: number; message: string }
        if (st.state === 'done') break
        if (st.state === 'error') throw new Error(st.message || 'Encoding failed')
        setProgress('Encoding the MP4', 0.7 + 0.28 * st.progress)
        await new Promise((r) => setTimeout(r, 400))
      }
      const mp4 = new Uint8Array(await (await call(info, `/jobs/${job.id}/file`)).arrayBuffer())
      setProgress('Saving', 1)
      return platform.saveExport(mp4, `${safeName(project.title)} – animatic.mp4`, 'mp4')
    } finally {
      // Clean up the helper's temp files whether we finished, failed or were cancelled.
      await call(info, `/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {})
    }
  })
}
