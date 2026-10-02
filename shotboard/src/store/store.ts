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

interface State {
  project: Project
  history: HistoryState
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

  run(cmd: Command): void
  undo(): void
  redo(): void
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
}

export const useStore = create<State>((set, get) => {
  const initial = makeStarterProject()
  return {
    project: initial,
    history: emptyHistory(),
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

    run: (cmd) => set((s) => execute(s.project, s.history, cmd)),
    undo: () => {
      const r = undo(get().project, get().history)
      if (r) set({ ...r, selection: pruneSelection(r.project, get()) })
    },
    redo: () => {
      const r = redo(get().project, get().history)
      if (r) set({ ...r, selection: pruneSelection(r.project, get()) })
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
    setHovered: (hoveredId) => set({ hoveredId })
  }
})

function pruneSelection(project: Project, s: State): string[] {
  const shot = project.shots.find((x) => x.id === s.activeShotId)
  const ids = new Set(shot?.scene.objects.map((o) => o.id))
  ids.add(CAMERA_ID)
  return s.selection.filter((id) => ids.has(id))
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
