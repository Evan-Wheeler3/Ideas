import { useRef, useState, type ReactNode } from 'react'
import {
  Clapperboard, ChevronDown, FilePlus2, FolderOpen, Globe, Magnet, Move3d, Redo2, Rotate3d, Save, Scale3d, Sparkles, Undo2,
  Keyboard,
  Box as BoxIcon
} from 'lucide-react'
import { toggleShortcuts } from './ShortcutsDialog'
import { useDirty, useStore, type GizmoMode } from '../store/store'
import { newProject, openProject, openSampleProject, saveProject } from '../persist/fileActions'
import { renameProject } from '../commands/shots'
import { EditableText } from './EditableText'
import { Popover } from './Popover'

const MOD = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl+'

function FileMenu() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)

  const item = (icon: ReactNode, label: string, keys: string, action: () => unknown) => (
    <button
      className="menu-item"
      onClick={() => {
        setOpen(false)
        void action()
      }}
    >
      {icon}
      <span>{label}</span>
      <kbd>{keys}</kbd>
    </button>
  )

  return (
    <>
      <button ref={btn} className={`file-btn${open ? ' on' : ''}`} onClick={() => setOpen((o) => !o)}>
        File <ChevronDown size={13} />
      </button>
      {open && (
        <Popover anchor={btn} onClose={() => setOpen(false)} className="file-menu">
          {item(<FilePlus2 size={14} />, 'New project', `${MOD}N`, newProject)}
          {item(<FolderOpen size={14} />, 'Open…', `${MOD}O`, openProject)}
          {item(<Sparkles size={14} />, 'Open sample project', '', openSampleProject)}
          <div className="menu-sep" />
          {item(<Save size={14} />, 'Save', `${MOD}S`, () => saveProject())}
          {item(<Save size={14} />, 'Save as…', `${MOD}Shift+S`, () => saveProject(true))}
        </Popover>
      )}
    </>
  )
}

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
  const run = useStore((s) => s.run)
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

  const lastUndo = past[past.length - 1]
  const nextRedo = future[0]

  return (
    <header className="toolbar">
      <div className="brand">
        <Clapperboard size={18} />
        <span>ShotBoard</span>
      </div>
      <FileMenu />
      <div className="doc-title">
        <EditableText
          className="title-input"
          value={title}
          title="Project title (shown on exports). Click to rename."
          onCommit={(t) => t.trim() && run(renameProject(title, t.trim()))}
        />
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
      <ToolButton title="Keyboard shortcuts (?)" onClick={toggleShortcuts}>
        <Keyboard size={16} />
      </ToolButton>
    </header>
  )
}
