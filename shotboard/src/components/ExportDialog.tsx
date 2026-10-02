import { useEffect, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { CheckCircle2, Download, FileText, Film, Images, Loader2, TriangleAlert, X } from 'lucide-react'
import { platform } from '../platform'
import { useStore } from '../store/store'
import { cancelExport, exportAnimatic, exportPdf, exportStills, frameSize, useExport } from '../export/exporters'
import { toast } from './Dialogs'

export const useExportDialog = create<{ open: boolean }>(() => ({ open: false }))
export const openExportDialog = () => useExportDialog.setState({ open: true })
const close = () => !useExport.getState().running && useExportDialog.setState({ open: false })

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="seg-small text">
      {options.map(([v, label]) => (
        <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Card({ icon, title, text, children, action }: { icon: ReactNode; title: string; text: string; children?: ReactNode; action: ReactNode }) {
  return (
    <div className="export-card">
      <div className="export-card-head">
        {icon}
        <div>
          <div className="export-card-title">{title}</div>
          <div className="export-card-text">{text}</div>
        </div>
      </div>
      <div className="export-card-options">{children}</div>
      {action}
    </div>
  )
}

const where = (path: string) => (platform.kind === 'web' ? `Downloaded ${path}` : `Saved to ${path}`)

async function go(work: () => Promise<string | null>, what: string) {
  try {
    const path = await work()
    if (path) toast(where(path))
    else if (path === null && useExport.getState().cancelRequested === false) toast(`${what} not saved`, 'info')
  } catch (e) {
    toast(`${what} failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
  }
}

export function ExportDialog() {
  const open = useExportDialog((s) => s.open)
  const running = useExport((s) => s.running)
  const shots = useStore((s) => s.project.shots)
  const fps = useStore((s) => s.project.settings.fps)
  const [helper, setHelper] = useState<{ ok: boolean; message: string } | null>(null)
  const [layout, setLayout] = useState<'storyboard' | 'list'>('storyboard')
  const [page, setPage] = useState<'letter' | 'a4'>('letter')
  const [stillW, setStillW] = useState(1920)
  const [movieW, setMovieW] = useState(1280)
  const [burnIn, setBurnIn] = useState(true)

  useEffect(() => {
    if (!open) return
    setHelper(null)
    void platform.sidecar().then((info) => setHelper('error' in info ? { ok: false, message: info.error } : { ok: true, message: 'Export helper ready' }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) return null
  const total = shots.reduce((a, s) => a + s.duration, 0)
  const frames = shots.reduce((a, s) => a + Math.max(1, Math.round(s.duration * fps)), 0)
  const busy = !!running
  const needsHelper = !helper?.ok
  const still = frameSize(stillW)
  const movie = frameSize(movieW)

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal export-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <Download size={16} className="modal-icon" /> Export
          <span className="spacer" />
          <button className="icon-btn" onClick={close} disabled={busy} title="Close (Esc)">
            <X size={14} />
          </button>
        </div>

        <div className={`helper-status ${helper ? (helper.ok ? 'ok' : 'bad') : ''}`}>
          {!helper && <Loader2 size={13} className="spin" />}
          {helper?.ok && <CheckCircle2 size={13} />}
          {helper && !helper.ok && <TriangleAlert size={13} />}
          <span>{helper ? helper.message : 'Checking the export helper…'}</span>
          {helper && !helper.ok && <span className="dim"> PDF and MP4 need it; stills work without it.</span>}
        </div>

        <div className="export-cards">
          <Card
            icon={<FileText size={20} />}
            title="Shot list PDF"
            text={`${shots.length} shots with pictures, type, lens, length, notes and your columns.`}
            action={
              <button className="btn primary" disabled={busy || needsHelper} onClick={() => go(() => exportPdf(layout, page), 'PDF export')}>
                Export PDF
              </button>
            }
          >
            <Seg<'storyboard' | 'list'> value={layout} options={[['storyboard', 'Storyboard'], ['list', 'Table']]} onChange={setLayout} />
            <Seg<'letter' | 'a4'> value={page} options={[['letter', 'Letter'], ['a4', 'A4']]} onChange={setPage} />
          </Card>

          <Card
            icon={<Images size={20} />}
            title="Stills"
            text={`One PNG per shot (first frame), ${still.width}×${still.height}, in a ZIP.`}
            action={
              <button className="btn primary" disabled={busy} onClick={() => go(() => exportStills(stillW), 'Stills export')}>
                Export stills
              </button>
            }
          >
            <Seg<number> value={stillW} options={[[1920, 'HD'], [3840, '4K']]} onChange={setStillW} />
          </Card>

          <Card
            icon={<Film size={20} />}
            title="Animatic MP4"
            text={`Every shot in order with camera moves: ${total.toFixed(1)}s, ${frames} frames at ${fps} fps, ${movie.width}×${movie.height}.`}
            action={
              <button className="btn primary" disabled={busy || needsHelper} onClick={() => go(() => exportAnimatic(movieW, burnIn), 'Animatic export')}>
                Export MP4
              </button>
            }
          >
            <Seg<number> value={movieW} options={[[960, 'Draft'], [1280, '720p'], [1920, '1080p']]} onChange={setMovieW} />
            <label className="check">
              <input type="checkbox" checked={burnIn} onChange={() => setBurnIn(!burnIn)} />
              <span>Burn in shot info</span>
            </label>
          </Card>
        </div>

        {running && (
          <div className="export-progress">
            <div className="export-progress-row">
              <Loader2 size={14} className="spin" />
              <span>{running.label}</span>
              <span className="spacer" />
              <span className="mono">{Math.round(running.progress * 100)}%</span>
              <button className="btn" onClick={cancelExport}>
                Cancel
              </button>
            </div>
            <div className="bar">
              <div style={{ width: `${running.progress * 100}%` }} />
            </div>
          </div>
        )}
        <div className="hint-small">Exports render through each shot's camera. Depth of field and ambient occlusion are viewport-only for now.</div>
      </div>
    </div>
  )
}
