import { create } from 'zustand'
import type { JointName, Project, SceneObject, Shot } from '../shared/types'
import { makeStarterProject } from '../shared/defaults'
import { emptyHistory, execute, isDirty, redo, undo, type Command, type HistoryState } from '../commands/command'

export type GizmoMode = 'translate' | 'rotate' | 'scale'
export type ViewMode = 'editor' | 'camera'

/** Selection id for the shot camera (it isn't a scene object). */
export const CAMERA_ID = '__camera'

export interface Guides {
  thirds: boolean
  safe: boolean
  center: boolean
  /** Opacity of the bars outside the frame, 0..1. */
  mask: number
}

export interface SnapSettings {
  enabled: boolean
  translate: number
  rotateDeg: number
  scale: number
}

/** Where the open project lives on disk (Electron) or what it's called (browser). */
export interface FileInfo {
  path: string | null
  name: string
}

interface State {
  project: Project
  history: HistoryState
  file: FileInfo
  activeShotId: string
  selection: string[]
  gizmo: GizmoMode
  gizmoSpace: 'world' | 'local'
  snap: SnapSettings
  viewMode: ViewMode
  /** Bumped to ask the viewport to frame the selection. */
  frameRequest: number
  /** A mannequin joint picked for posing (its object stays selected). */
  joint: { objectId: string; joint: JointName } | null
  guides: Guides
  showLabels: boolean
  hoveredId: string | null
  /** Time within the active shot, in seconds. */
  playhead: number
  playing: boolean
  /** Play just this shot, or every shot in order (the animatic). */
  playScope: 'shot' | 'sequence'
  loop: boolean
  selectedKeyId: string | null

  run(cmd: Command): void
  undo(): void
  redo(): void
  /** Replace the whole project (open, new, recover). Clears undo history. */
  loadProject(project: Project, file: FileInfo, opts?: { dirty?: boolean }): void
  markSaved(file: FileInfo): void
  setActiveShot(id: string): void
  select(ids: string[]): void
  toggleSelect(id: string): void
  setGizmo(mode: GizmoMode): void
  toggleGizmoSpace(): void
  setSnap(patch: Partial<SnapSettings>): void
  setViewMode(mode: ViewMode): void
  requestFrame(): void
  selectJoint(objectId: string, joint: JointName | null): void
  setGuides(patch: Partial<Guides>): void
  toggleLabels(): void
  setHovered(id: string | null): void
  setPlayhead(t: number): void
  play(scope: 'shot' | 'sequence'): void
  pause(): void
  setLoop(loop: boolean): void
  selectKey(id: string | null): void
}

/** Keep the active shot valid after the shot list changes (e.g. the active shot was deleted). */
function resolveActive(prev: Project, next: Project, activeId: string, prefer?: string): string {
  if (prefer && next.shots.some((s) => s.id === prefer)) return prefer
  if (next.shots.some((s) => s.id === activeId)) return activeId
  const oldIndex = Math.max(prev.shots.findIndex((s) => s.id === activeId), 0)
  return next.shots[Math.min(oldIndex, next.shots.length - 1)]?.id ?? next.shots[0].id
}

export const useStore = create<State>((set, get) => {
  const initial = makeStarterProject()

  /** Apply a history step, moving to the shot it touched so the change is visible. */
  const applyStep = (r: { project: Project; history: HistoryState } | null, cmd: Command | undefined) => {
    if (!r) return
    const s = get()
    const activeShotId = resolveActive(s.project, r.project, s.activeShotId, cmd?.shotId)
    const switched = activeShotId !== s.activeShotId
    set({
      ...r,
      activeShotId,
      selection: switched ? [] : pruneSelection(r.project, activeShotId, s.selection),
      joint: switched ? null : s.joint
    })
  }

  return {
    project: initial,
    history: emptyHistory(),
    file: { path: null, name: 'Untitled' },
    activeShotId: initial.shots[0].id,
    selection: [],
    gizmo: 'translate',
    gizmoSpace: 'world',
    snap: { enabled: false, translate: 0.25, rotateDeg: 15, scale: 0.1 },
    viewMode: 'editor',
    frameRequest: 0,
    joint: null,
    guides: { thirds: true, safe: false, center: false, mask: 0.92 },
    showLabels: true,
    hoveredId: null,
    playhead: 0,
    playing: false,
    playScope: 'shot',
    loop: false,
    selectedKeyId: null,

    run: (cmd) => {
      const s = get()
      const r = execute(s.project, s.history, cmd)
      const activeShotId = resolveActive(s.project, r.project, s.activeShotId)
      set({ ...r, activeShotId, selection: pruneSelection(r.project, activeShotId, s.selection) })
    },
    undo: () => applyStep(undo(get().project, get().history), get().history.past.at(-1)),
    redo: () => applyStep(redo(get().project, get().history), get().history.future[0]),
    loadProject: (project, file, opts) => {
      const history = emptyHistory()
      if (opts?.dirty) history.savedAt = -1
      set({
        project,
        history,
        file,
        activeShotId: project.shots[0].id,
        selection: [],
        joint: null,
        hoveredId: null,
        viewMode: 'editor',
        playhead: 0,
        playing: false,
        selectedKeyId: null
      })
    },
    markSaved: (file) => set((s) => ({ file, history: { ...s.history, savedAt: s.history.past.length, lastAt: 0 } })),
    setActiveShot: (id) => {
      if (id === get().activeShotId) return
      // During sequence playback the player sets the playhead itself.
      set({ activeShotId: id, selection: [], joint: null, hoveredId: null, selectedKeyId: null, playhead: 0 })
    },
    select: (ids) => set({ selection: ids, joint: null }),
    toggleSelect: (id) =>
      set((s) => ({
        joint: null,
        selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]
      })),
    setGizmo: (gizmo) => set({ gizmo }),
    toggleGizmoSpace: () => set((s) => ({ gizmoSpace: s.gizmoSpace === 'world' ? 'local' : 'world' })),
    setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),
    setViewMode: (viewMode) => set({ viewMode }),
    requestFrame: () => set((s) => ({ frameRequest: s.frameRequest + 1 })),
    selectJoint: (objectId, joint) =>
      set({ selection: [objectId], joint: joint ? { objectId, joint } : null, gizmo: joint ? 'rotate' : get().gizmo }),
    setGuides: (patch) => set((s) => ({ guides: { ...s.guides, ...patch } })),
    toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
    setHovered: (hoveredId) => set({ hoveredId }),
    setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
    play: (scope) => {
      const s = get()
      if (scope === 'sequence') {
        // The animatic always starts from the first shot, looking through the camera.
        set({ playing: true, playScope: 'sequence', activeShotId: s.project.shots[0].id, playhead: 0, selection: [], joint: null, viewMode: 'camera' })
        return
      }
      const shot = s.project.shots.find((x) => x.id === s.activeShotId)
      const atEnd = shot && s.playhead >= shot.duration - 1e-3
      set({ playing: true, playScope: 'shot', playhead: atEnd ? 0 : s.playhead })
    },
    pause: () => set({ playing: false }),
    setLoop: (loop) => set({ loop }),
    selectKey: (selectedKeyId) => set({ selectedKeyId })
  }
})

function pruneSelection(project: Project, activeShotId: string, selection: string[]): string[] {
  const shot = project.shots.find((x) => x.id === activeShotId)
  const ids = new Set(shot?.scene.objects.map((o) => o.id))
  ids.add(CAMERA_ID)
  return selection.filter((id) => ids.has(id))
}

// Selectors
export const useActiveShot = (): Shot =>
  useStore((s) => s.project.shots.find((x) => x.id === s.activeShotId) ?? s.project.shots[0])

export const useSelectedObjects = (): SceneObject[] => {
  const shot = useActiveShot()
  const selection = useStore((s) => s.selection)
  return shot.scene.objects.filter((o) => selection.includes(o.id))
}

export const useDirty = (): boolean => useStore((s) => isDirty(s.history))

export const getActiveShot = (): Shot => {
  const s = useStore.getState()
  return s.project.shots.find((x) => x.id === s.activeShotId) ?? s.project.shots[0]
}

// Dev builds only: expose the store for debugging and the browser smoke test.
if (import.meta.env.DEV) (window as unknown as { __shotboard: typeof useStore }).__shotboard = useStore
