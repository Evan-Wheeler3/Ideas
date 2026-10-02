import { useEffect } from 'react'
import { useStore } from './store/store'
import { deleteSelection, duplicateSelection } from './store/actions'

interface Shortcut {
  /** e.g. "w", "mod+z", "mod+shift+z", "delete" */
  keys: string[]
  run(): void
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['w'], run: () => useStore.getState().setGizmo('translate') },
  { keys: ['e'], run: () => useStore.getState().setGizmo('rotate') },
  { keys: ['r'], run: () => useStore.getState().setGizmo('scale') },
  { keys: ['q'], run: () => useStore.getState().toggleGizmoSpace() },
  { keys: ['x'], run: () => useStore.getState().setSnap({ enabled: !useStore.getState().snap.enabled }) },
  { keys: ['f'], run: () => useStore.getState().requestFrame() },
  { keys: ['c'], run: () => useStore.getState().setViewMode(useStore.getState().viewMode === 'camera' ? 'editor' : 'camera') },
  { keys: ['l'], run: () => useStore.getState().toggleLabels() },
  { keys: ['g'], run: () => useStore.getState().setGuides({ thirds: !useStore.getState().guides.thirds }) },
  {
    keys: ['escape'],
    // Leave joint posing first, then clear the selection.
    run: () => {
      const s = useStore.getState()
      if (s.joint) s.selectJoint(s.joint.objectId, null)
      else s.select([])
    }
  },
  { keys: ['delete', 'backspace'], run: deleteSelection },
  { keys: ['mod+d'], run: duplicateSelection },
  { keys: ['mod+z'], run: () => useStore.getState().undo() },
  { keys: ['mod+shift+z', 'mod+y'], run: () => useStore.getState().redo() }
]

export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('mod')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const combo = comboFromEvent(e)
      const hit = SHORTCUTS.find((s) => s.keys.includes(combo))
      if (!hit) return
      e.preventDefault()
      hit.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
