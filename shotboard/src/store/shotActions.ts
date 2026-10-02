// Shot list actions shared by the shot panel, Properties and keyboard shortcuts.
import { newId } from '../shared/defaults'
import type { Shot } from '../shared/types'
import { addShot, deleteShot, moveShot } from '../commands/shots'
import { toast } from '../components/Dialogs'
import { useStore } from './store'
import { useThumbs } from './thumbs'

/** A copy of a shot with a new id. Its thumbnail is copied too (same picture until it changes). */
function copyOf(shot: Shot): Shot {
  const copy: Shot = { ...structuredClone(shot), id: newId(), numberLocked: false }
  const thumb = useThumbs.getState().byShot[shot.id]
  if (thumb) useThumbs.getState().put(copy.id, thumb)
  return copy
}

/** New shot right after the current one, starting from a copy of it (same set, same camera). */
export function newShot(): void {
  const { project, activeShotId, run, setActiveShot } = useStore.getState()
  const index = project.shots.findIndex((s) => s.id === activeShotId)
  const shot = copyOf(project.shots[index])
  shot.notes = ''
  run({ ...addShot(project.shots, shot, index + 1), label: 'New shot' })
  setActiveShot(shot.id)
}

export function duplicateShot(id: string): void {
  const { project, run, setActiveShot } = useStore.getState()
  const index = project.shots.findIndex((s) => s.id === id)
  if (index < 0) return
  const shot = copyOf(project.shots[index])
  run({ ...addShot(project.shots, shot, index + 1), label: `Duplicate shot ${project.shots[index].number}` })
  setActiveShot(shot.id)
}

export function removeShot(id: string): void {
  const { project, run } = useStore.getState()
  if (project.shots.length <= 1) {
    toast('A project needs at least one shot.', 'info')
    return
  }
  run(deleteShot(project.shots, id))
}

export function reorderShot(id: string, toIndex: number): void {
  const { project, run } = useStore.getState()
  const from = project.shots.findIndex((s) => s.id === id)
  // Dropping a shot onto its own slot (before or after itself) changes nothing.
  if (from < 0 || toIndex === from || toIndex === from + 1) return
  run(moveShot(project.shots, id, toIndex > from ? toIndex - 1 : toIndex))
}

export function stepShot(delta: 1 | -1): void {
  const { project, activeShotId, setActiveShot } = useStore.getState()
  const i = project.shots.findIndex((s) => s.id === activeShotId)
  const next = project.shots[Math.min(Math.max(i + delta, 0), project.shots.length - 1)]
  if (next) setActiveShot(next.id)
}
