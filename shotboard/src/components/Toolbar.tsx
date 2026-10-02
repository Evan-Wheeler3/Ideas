import type { ReactNode } from 'react'
import { Clapperboard, Globe, Magnet, Move3d, Redo2, Rotate3d, Scale3d, Undo2, Video, Box as BoxIcon } from 'lucide-react'
import { useDirty, useStore, type GizmoMode } from '../store/store'

function ToolButton({
  active,
  title,
  onClick,
  disabled,
  children
}: {
  active?: boolean
  title: string
  onClick(): void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button className={`tool-btn${active ? ' active' : ''}`} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

const GIZMOS: { mode: GizmoMode; icon: typeof Move3d; title: string }[] = [
  { mode: 'translate', icon: Move3d, title: 'Move (W)' },
  { mode: 'rotate', icon: Rotate3d, title: 'Rotate (E)' },
  { mode: 'scale', icon: Scale3d, title: 'Scale (R)' }
]

export function Toolbar() {
  const title = useStore((s) => s.project.title)
  const dirty = useDirty()
  const gizmo = useStore((s) => s.gizmo)
  const setGizmo = useStore((s) => s.setGizmo)
  const space = useStore((s) => s.gizmoSpace)
  const toggleSpace = useStore((s) => s.toggleGizmoSpace)
  const snap = useStore((s) => s.snap)
  const setSnap = useStore((s) => s.setSnap)
  const past = useStore((s) => s.history.past)
  const future = useStore((s) => s.history.future)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const viewMode = useStore((s) => s.viewMode)

  const lastUndo = past[past.length - 1]
  const nextRedo = future[0]

  return (
    <header className="toolbar">
      <div className="brand">
        <Clapperboard size={18} />
        <span>ShotBoard</span>
      </div>
      <div className="doc-title">
        {title}
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
      </div>

      <div className="toolbar-group">
        <ToolButton title={lastUndo ? `Undo ${lastUndo.label} (Ctrl+Z)` : 'Nothing to undo'} onClick={undo} disabled={!lastUndo}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton title={nextRedo ? `Redo ${nextRedo.label} (Ctrl+Shift+Z)` : 'Nothing to redo'} onClick={redo} disabled={!nextRedo}>
          <Redo2 size={16} />
        </ToolButton>
      </div>

      <div className="toolbar-group">
        {GIZMOS.map(({ mode, icon: Icon, title: t }) => (
          <ToolButton key={mode} active={gizmo === mode} title={t} onClick={() => setGizmo(mode)}>
            <Icon size={16} />
          </ToolButton>
        ))}
        <ToolButton title={`Transform space: ${space} (Q)`} onClick={toggleSpace} active={space === 'local'}>
          {space === 'world' ? <Globe size={16} /> : <BoxIcon size={16} />}
        </ToolButton>
        <ToolButton
          active={snap.enabled}
          title={`Snap ${snap.enabled ? 'on' : 'off'}: ${snap.translate} m · ${snap.rotateDeg}° · ${snap.scale} (X)`}
          onClick={() => setSnap({ enabled: !snap.enabled })}
        >
          <Magnet size={16} />
        </ToolButton>
      </div>

      <div className="spacer" />

      <div className="segmented" title="Camera view arrives in milestone 2">
        <button className={viewMode === 'editor' ? 'active' : ''}>
          <BoxIcon size={14} /> Editor
        </button>
        <button disabled>
          <Video size={14} /> Camera
        </button>
      </div>
    </header>
  )
}
