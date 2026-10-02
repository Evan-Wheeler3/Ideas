// The timeline for the current shot: play / scrub, camera keyframes, preset moves and handheld shake.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Diamond, Film, Pause, Play, Plus, Repeat, Route, Trash2, X } from 'lucide-react'
import type { Ease } from '../shared/types'
import { EASE_LABELS, snapToFrame } from '../camera/animate'
import { MOVES, type MoveId } from '../camera/moves'
import { useActiveShot, useStore } from '../store/store'
import {
  SHAKE_LEVELS, addKeyAtPlayhead, applyMove, clearKeys, deleteKey, moveKey, sequenceTiming, setHandheld, setKeyEase, togglePlay
} from '../store/cameraActions'
import { Popover } from './Popover'

const PAD = 14 // px of track on either side of 0 and the end

function tickStep(duration: number): number {
  if (duration <= 6) return 0.5
  if (duration <= 15) return 1
  if (duration <= 40) return 2
  return 5
}

function MovesMenu({ anchor, onClose }: { anchor: React.RefObject<HTMLElement | null>; onClose(): void }) {
  const [amount, setAmount] = useState(1)
  return (
    <Popover anchor={anchor} onClose={onClose} className="moves-menu">
      <div className="menu-title">Camera moves</div>
      <div className="hint-small moves-hint">Starts from the camera as it is now and runs for the whole shot. Replaces the current move.</div>
      <div className="moves-grid">
        {MOVES.map((m) => (
          <button
            key={m.id}
            className="move-btn"
            title={m.hint}
            onClick={() => {
              applyMove(m.id as MoveId, amount)
              onClose()
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="amount-row">
        <span>Amount</span>
        <input type="range" min={0.25} max={2} step={0.05} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <span className="mono">{Math.round(amount * 100)}%</span>
      </div>
    </Popover>
  )
}

export function Timeline() {
  const shot = useActiveShot()
  const shots = useStore((s) => s.project.shots)
  const fps = useStore((s) => s.project.settings.fps)
  const playhead = useStore((s) => s.playhead)
  const playing = useStore((s) => s.playing)
  const playScope = useStore((s) => s.playScope)
  const loop = useStore((s) => s.loop)
  const selectedKeyId = useStore((s) => s.selectedKeyId)
  const { setPlayhead, pause, setLoop, selectKey } = useStore.getState()
  const track = useRef<HTMLDivElement>(null)
  const movesBtn = useRef<HTMLButtonElement>(null)
  const [movesOpen, setMovesOpen] = useState(false)
  // A key being dragged: shown at its new time until released.
  const [drag, setDrag] = useState<{ id: string; t: number } | null>(null)

  const d = shot.duration
  const selectedKey = shot.keys.find((k) => k.id === selectedKeyId)
  const seq = sequenceTiming(shots, shot.id)

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const u = (clientX - r.left - PAD) / (r.width - PAD * 2)
    return snapToFrame(Math.min(Math.max(u, 0), 1) * d, fps)
  }
  const xOf = (t: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${Math.min(t / d, 1)})`

  const scrub = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    pause()
    selectKey(null)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setPlayhead(timeAt(e.clientX))
  }

  const step = tickStep(d)
  const ticks = Array.from({ length: Math.floor(d / step + 1e-6) + 1 }, (_, i) => i * step)

  return (
    <section className="panel timeline">
      <div className="tl-controls">
        <div className="tl-group">
          <button
            className={`tl-btn primary${playing && playScope === 'shot' ? ' on' : ''}`}
            onClick={() => togglePlay('shot')}
            title="Play this shot (Space)"
          >
            {playing && playScope === 'shot' ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            className={`tl-btn${playing && playScope === 'sequence' ? ' on' : ''}`}
            onClick={() => togglePlay('sequence')}
            title="Play all shots as an animatic (Shift+Space)"
          >
            {playing && playScope === 'sequence' ? <Pause size={14} /> : <Film size={14} />} All
          </button>
          <button className={`tl-btn icon${loop ? ' on' : ''}`} onClick={() => setLoop(!loop)} title="Loop">
            <Repeat size={14} />
          </button>
        </div>
        <div className="tl-time mono" title="Shot time · frame · position in the whole sequence">
          <strong>{playhead.toFixed(2)}</strong> / {d.toFixed(2)}s<span className="dim"> · f{Math.round(playhead * fps)}</span>
          <span className="dim"> · seq {(seq.start + playhead).toFixed(1)} / {seq.total.toFixed(1)}s</span>
        </div>
        <span className="spacer" />
        <div className="tl-group">
          <button className="tl-btn" onClick={addKeyAtPlayhead} title="Add a camera keyframe at the playhead (K)">
            <Plus size={14} /> Key
          </button>
          <button ref={movesBtn} className={`tl-btn${movesOpen ? ' on' : ''}`} onClick={() => setMovesOpen((o) => !o)} title="Preset camera moves">
            <Route size={14} /> Moves
          </button>
          {movesOpen && <MovesMenu anchor={movesBtn} onClose={() => setMovesOpen(false)} />}
          <label className="tl-select" title="Handheld camera shake (plays back, not shown while editing)">
            <span>Handheld</span>
            <select value={shot.shake.intensity} onChange={(e) => setHandheld(Number(e.target.value))}>
              {SHAKE_LEVELS.map((l) => (
                <option key={l.label} value={l.intensity}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedKey && (
          <div className="tl-group key-tools">
            <Diamond size={13} className="key-icon" />
            <span className="mono">{selectedKey.t.toFixed(2)}s</span>
            <select
              value={selectedKey.ease}
              onChange={(e) => setKeyEase(selectedKey.id, e.target.value as Ease)}
              title="How the move eases out of this key toward the next one"
            >
              {(Object.keys(EASE_LABELS) as Ease[]).map((e) => (
                <option key={e} value={e}>
                  {EASE_LABELS[e]}
                </option>
              ))}
            </select>
            <button className="tl-btn icon" onClick={() => deleteKey(selectedKey.id)} title="Delete this key (Delete)">
              <Trash2 size={13} />
            </button>
          </div>
        )}
        {shot.keys.length > 0 && !selectedKey && (
          <button className="tl-btn" onClick={clearKeys} title="Remove the camera move; the camera stays where it is now">
            <X size={13} /> Clear move
          </button>
        )}
      </div>

      <div className="tl-track" ref={track} onPointerDown={scrub} onPointerMove={(e) => e.buttons === 1 && !drag && setPlayhead(timeAt(e.clientX))}>
        {ticks.map((t) => (
          <div key={t} className={`tl-tick${Number.isInteger(t) ? ' major' : ''}`} style={{ left: xOf(t) }}>
            {Number.isInteger(t) && <span>{t}s</span>}
          </div>
        ))}
        {shot.keys.length >= 2 && (
          <div
            className="tl-span"
            style={{ left: xOf(shot.keys[0].t), width: `calc((100% - ${PAD * 2}px) * ${(shot.keys.at(-1)!.t - shot.keys[0].t) / d})` }}
          />
        )}
        {shot.keys.map((k) => {
          const t = drag?.id === k.id ? drag.t : k.t
          return (
            <div
              key={k.id}
              className={`tl-key${k.id === selectedKeyId ? ' selected' : ''}`}
              style={{ left: xOf(t) }}
              title={`Key at ${k.t.toFixed(2)}s · ${Math.round(k.focalLength)}mm · ${EASE_LABELS[k.ease]}. Drag to move.`}
              onPointerDown={(e) => {
                e.stopPropagation()
                pause()
                selectKey(k.id)
                setPlayhead(k.t)
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                setDrag({ id: k.id, t: k.t })
              }}
              onPointerMove={(e) => {
                if (drag?.id !== k.id) return
                const nt = timeAt(e.clientX)
                setDrag({ id: k.id, t: nt })
                setPlayhead(nt)
              }}
              onPointerUp={() => {
                if (drag?.id === k.id && drag.t !== k.t) moveKey(k.id, drag.t)
                setDrag(null)
              }}
            />
          )
        })}
        <div className="tl-playhead" style={{ left: xOf(playhead) }} />
        {shot.keys.length === 0 && (
          <div className="tl-empty">Static shot. Press K to add a camera key, or pick a preset from Moves.</div>
        )}
      </div>
    </section>
  )
}
