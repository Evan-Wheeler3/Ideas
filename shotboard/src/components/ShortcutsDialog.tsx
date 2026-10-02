// The keyboard shortcut sheet (press ?).
import { useEffect } from 'react'
import { create } from 'zustand'
import { Keyboard, X } from 'lucide-react'

const MOD = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Scene',
    items: [
      ['W / E / R', 'Move / rotate / scale'],
      ['Q', 'World / local axes'],
      ['X', 'Snapping on / off'],
      ['F', 'Frame the selection (camera view: aim at it)'],
      ['L', 'Name labels on / off'],
      [`${MOD}+D`, 'Duplicate'],
      ['Del', 'Delete (a selected key first)'],
      ['Esc', 'Stop / leave posing / deselect']
    ]
  },
  {
    title: 'Camera',
    items: [
      ['C', 'Editor view / look through the camera'],
      ['G', 'Rule-of-thirds guide'],
      ['Drag · right-drag · scroll', 'In camera view: orbit · pan · dolly the shot camera']
    ]
  },
  {
    title: 'Timeline',
    items: [
      ['Space', 'Play / pause the shot'],
      ['Shift+Space', 'Play all shots (animatic)'],
      ['K', 'Add a camera key at the playhead'],
      ['← / →', 'Step one frame (Shift: one second)'],
      ['Home / End', 'Start / end of the shot']
    ]
  },
  {
    title: 'Shots & files',
    items: [
      ['N', 'New shot (copy of the current one)'],
      ['[ / ]', 'Previous / next shot'],
      [`${MOD}+Z / ${MOD}+Shift+Z`, 'Undo / redo'],
      [`${MOD}+S / ${MOD}+Shift+S`, 'Save / save as'],
      [`${MOD}+O / ${MOD}+N`, 'Open / new project'],
      [`${MOD}+E`, 'Export (PDF, stills, MP4)'],
      ['?', 'This list']
    ]
  }
]

export const useShortcutsDialog = create<{ open: boolean }>(() => ({ open: false }))
export const toggleShortcuts = () => useShortcutsDialog.setState((s) => ({ open: !s.open }))

export function ShortcutsDialog() {
  const open = useShortcutsDialog((s) => s.open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        useShortcutsDialog.setState({ open: false })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={() => useShortcutsDialog.setState({ open: false })}>
      <div className="modal shortcuts" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <Keyboard size={16} className="modal-icon" /> Keyboard shortcuts
          <span className="spacer" />
          <button className="icon-btn" onClick={() => useShortcutsDialog.setState({ open: false })} title="Close (Esc)">
            <X size={14} />
          </button>
        </div>
        <div className="shortcut-grid">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="menu-title">{g.title}</div>
              {g.items.map(([k, v]) => (
                <div key={k} className="shortcut-row">
                  <kbd>{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
