import { useEffect } from 'react'
import { useStore } from './store/store'
import { deleteSelection, duplicateSelection } from './store/actions'
import { newShot, stepShot } from './store/shotActions'
import { newProject, openProject, saveProject } from './persist/fileActions'
import { addKeyAtPlayhead, deleteKey, stepFrames, togglePlay } from './store/cameraActions'

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
      if (s.playing) s.pause()
      else if (s.joint) s.selectJoint(s.joint.objectId, null)
      else if (s.selectedKeyId) s.selectKey(null)
      else s.select([])
    }
  },
  {
    keys: ['delete', 'backspace'],
    // A selected timeline key goes first; otherwise delete the selected objects.
    run: () => {
      const id = useStore.getState().selectedKeyId
      if (id) deleteKey(id)
      else deleteSelection()
    }
  },
  { keys: [' '], run: () => togglePlay('shot') },
  { keys: ['shift+ '], run: () => togglePlay('sequence') },
  { keys: ['k'], run: addKeyAtPlayhead },
  { keys: ['arrowleft'], run: () => stepFrames(-1) },
  { keys: ['arrowright'], run: () => stepFrames(1) },
  { keys: ['shift+arrowleft'], run: () => stepFrames(-useStore.getState().project.settings.fps) },
  { keys: ['shift+arrowright'], run: () => stepFrames(useStore.getState().project.settings.fps) },
  { keys: ['home'], run: () => stepFrames(-1e6) },
  { keys: ['end'], run: () => stepFrames(1e6) },
  { keys: ['mod+d'], run: duplicateSelection },
  { keys: ['n'], run: newShot },
  { keys: ['['], run: () => stepShot(-1) },
  { keys: [']'], run: () => stepShot(1) },
  { keys: ['mod+s'], run: () => void saveProject() },
  { keys: ['mod+shift+s'], run: () => void saveProject(true) },
  { keys: ['mod+o'], run: () => void openProject() },
  { keys: ['mod+n'], run: () => void newProject() },
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
    // After picking from a dropdown, give focus back to the app so Space, arrows etc. work again.
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') (e.target as HTMLElement).blur()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('change', onChange)
    }
  }, [])
}
