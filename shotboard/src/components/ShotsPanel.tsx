// The shot list: a storyboard grid of thumbnails, or a table with configurable columns.
// Click a shot to work on it; drag to reorder.
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Copy, GripVertical, LayoutGrid, Plus, Rows3, Trash2 } from 'lucide-react'
import type { ColumnDef, Shot } from '../shared/types'
import { lensLabel, aspectValue } from '../camera/lens'
import { useStore } from '../store/store'
import { useThumbs } from '../store/thumbs'
import { duplicateShot, newShot, removeShot, reorderShot } from '../store/shotActions'
import { Panel } from './Panel'
import { EditableText } from './EditableText'
import { ColumnsMenu } from './ColumnsMenu'
import { CustomFieldInput, TypeSelect, setShotDuration, setShotNotes, setShotNumber, typeLabel } from './shotFields'

type View = 'grid' | 'list'
const DRAG_TYPE = 'application/x-shotboard-shot'

const totalTime = (shots: Shot[]) => {
  const s = shots.reduce((a, x) => a + x.duration, 0)
  return s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}s`
}

/** Drag-to-reorder state shared by both views: which shot is moving and where it would land. */
function useShotDrag() {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  return {
    dragId,
    dropIndex,
    start: (e: DragEvent, id: string) => {
      e.dataTransfer.setData(DRAG_TYPE, id)
      e.dataTransfer.effectAllowed = 'move'
      setDragId(id)
    },
    over: (e: DragEvent, index: number, horizontal: boolean) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const after = horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2
      setDropIndex(index + (after ? 1 : 0))
    },
    drop: (e: DragEvent) => {
      const id = e.dataTransfer.getData(DRAG_TYPE)
      e.preventDefault()
      if (id && dropIndex !== null) reorderShot(id, dropIndex)
      setDragId(null)
      setDropIndex(null)
    },
    end: () => {
      setDragId(null)
      setDropIndex(null)
    }
  }
}

function Thumb({ shot, className }: { shot: Shot; className?: string }) {
  const thumb = useThumbs((s) => s.byShot[shot.id])
  const aspect = useStore((s) => s.project.settings.aspect)
  return (
    <div className={`thumb ${className ?? ''}`} style={{ aspectRatio: String(aspectValue(aspect)) }}>
      {thumb ? <img src={thumb.url} alt={`Shot ${shot.number}`} draggable={false} /> : <span className="thumb-pending">Rendering…</span>}
    </div>
  )
}

function CardActions({ shot }: { shot: Shot }) {
  return (
    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" title="Duplicate shot" onClick={() => duplicateShot(shot.id)}>
        <Copy size={13} />
      </button>
      <button className="icon-btn" title="Delete shot" onClick={() => removeShot(shot.id)}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function GridView({ shots, activeId }: { shots: Shot[]; activeId: string }) {
  const setActive = useStore((s) => s.setActiveShot)
  const drag = useShotDrag()
  return (
    <div className="shot-grid" onDragLeave={(e) => e.currentTarget === e.target && drag.end()}>
      {shots.map((shot, i) => (
        <div
          key={shot.id}
          className={[
            'shot-card',
            shot.id === activeId && 'active',
            drag.dragId === shot.id && 'dragging',
            drag.dropIndex === i && 'drop-before',
            drag.dropIndex === i + 1 && i === shots.length - 1 && 'drop-after'
          ]
            .filter(Boolean)
            .join(' ')}
          draggable
          onDragStart={(e) => drag.start(e, shot.id)}
          onDragOver={(e) => drag.over(e, i, true)}
          onDrop={drag.drop}
          onDragEnd={drag.end}
          onClick={() => setActive(shot.id)}
          title={shot.notes || undefined}
        >
          <div className="shot-card-img">
            <Thumb shot={shot} />
            <span className="shot-badge">{shot.number}</span>
            <span className="shot-duration">{shot.duration.toFixed(1)}s</span>
            <CardActions shot={shot} />
          </div>
          <div className="shot-meta">
            <span className="shot-type" title={typeLabel(shot.type)}>
              {shot.type}
            </span>
            <span className="mono dim">{lensLabel(shot.camera)}</span>
          </div>
          <div className={`shot-notes${shot.notes ? '' : ' empty-notes'}`}>{shot.notes || 'No notes'}</div>
        </div>
      ))}
      <button className="shot-card add-card" onClick={newShot} title="New shot (N)">
        <Plus size={22} strokeWidth={1.5} />
        <span>New shot</span>
      </button>
    </div>
  )
}

function Cell({ col, shot, index }: { col: ColumnDef; shot: Shot; index: number }): ReactNode {
  switch (col.id) {
    case 'thumb':
      return <Thumb shot={shot} className="small" />
    case 'number':
      return <EditableText className="num-input" value={shot.number} title="Type a number like 12A; clear it to go back to automatic" onCommit={(t) => setShotNumber(shot, index, t)} />
    case 'type':
      return <TypeSelect shot={shot} className="select" />
    case 'lens':
      return <span className="mono dim">{lensLabel(shot.camera)}</span>
    case 'duration':
      return (
        <EditableText
          className="mono"
          value={shot.duration.toFixed(1)}
          onCommit={(t) => {
            const n = Number.parseFloat(t)
            if (Number.isFinite(n)) setShotDuration(shot, n)
          }}
        />
      )
    case 'notes':
      return <EditableText value={shot.notes} placeholder="Add notes…" onCommit={(t) => setShotNotes(shot, t)} />
    default:
      return <CustomFieldInput shot={shot} col={col} />
  }
}

const COL_WIDTH: Record<string, string> = { thumb: '104px', number: '56px', type: '110px', lens: '96px', duration: '72px', notes: 'minmax(200px, 3fr)' }

function ListView({ shots, activeId }: { shots: Shot[]; activeId: string }) {
  const columns = useStore((s) => s.project.shotColumns).filter((c) => c.visible)
  const setActive = useStore((s) => s.setActiveShot)
  const drag = useShotDrag()
  const template = ['24px', ...columns.map((c) => COL_WIDTH[c.id] ?? 'minmax(120px, 1.4fr)'), '60px'].join(' ')

  return (
    <div className="shot-table" role="table">
      <div className="shot-row head" style={{ gridTemplateColumns: template }} role="row">
        <span />
        {columns.map((c) => (
          <span key={c.id} role="columnheader">
            {c.label}
          </span>
        ))}
        <span />
      </div>
      {shots.map((shot, i) => (
        <div
          key={shot.id}
          role="row"
          className={['shot-row', shot.id === activeId && 'active', drag.dragId === shot.id && 'dragging', drag.dropIndex === i && 'drop-before', drag.dropIndex === i + 1 && i === shots.length - 1 && 'drop-after']
            .filter(Boolean)
            .join(' ')}
          style={{ gridTemplateColumns: template }}
          onDragOver={(e) => drag.over(e, i, false)}
          onDrop={drag.drop}
          onMouseDown={() => setActive(shot.id)}
        >
          <span className="drag-handle" draggable onDragStart={(e) => drag.start(e, shot.id)} onDragEnd={drag.end} title="Drag to reorder">
            <GripVertical size={14} />
          </span>
          {columns.map((c) => (
            <span key={c.id} className={`cell cell-${c.id}`} role="cell">
              <Cell col={c} shot={shot} index={i} />
            </span>
          ))}
          <span className="row-actions">
            <CardActions shot={shot} />
          </span>
        </div>
      ))}
      <button className="add-row" onClick={newShot}>
        <Plus size={14} /> New shot
      </button>
    </div>
  )
}

export function ShotsPanel() {
  const shots = useStore((s) => s.project.shots)
  const activeId = useStore((s) => s.activeShotId)
  const [view, setView] = useState<View>('grid')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsBtn = useRef<HTMLButtonElement>(null)

  return (
    <Panel
      title="Shots"
      actions={
        <>
          <span className="panel-info">
            {shots.length} {shots.length === 1 ? 'shot' : 'shots'} · {totalTime(shots)}
          </span>
          <div className="seg-small">
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title="Storyboard grid">
              <LayoutGrid size={13} />
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="Shot list table">
              <Rows3 size={13} />
            </button>
          </div>
          {view === 'list' && (
            <>
              <button ref={columnsBtn} className={`panel-btn${columnsOpen ? ' on' : ''}`} onClick={() => setColumnsOpen((o) => !o)}>
                Columns
              </button>
              {columnsOpen && <ColumnsMenu anchor={columnsBtn} onClose={() => setColumnsOpen(false)} />}
            </>
          )}
          <button className="panel-btn" onClick={newShot} title="New shot from the current one (N)">
            <Plus size={13} /> New shot
          </button>
        </>
      }
    >
      {view === 'grid' ? <GridView shots={shots} activeId={activeId} /> : <ListView shots={shots} activeId={activeId} />}
    </Panel>
  )
}
