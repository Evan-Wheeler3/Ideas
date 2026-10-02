import type { ColumnDef, Project, Shot } from '../shared/types'
import type { Command } from './command'

const clone = <T>(v: T): T => structuredClone(v)

/** Give every shot without a typed-in number its position in the list (1, 2, 3...). */
export function renumber(shots: Shot[]): Shot[] {
  return shots.map((s, i) => (s.numberLocked || s.number === String(i + 1) ? s : { ...s, number: String(i + 1) }))
}

/**
 * Replace the whole shot list (add, delete, duplicate, reorder). Shots are immutable,
 * so keeping both lists is cheap: unchanged shots are shared, not copied.
 */
export function replaceShots(label: string, before: Shot[], after: Shot[]): Command {
  const next = renumber(after)
  return {
    label,
    do: (p) => void (p.shots = clone(next)),
    undo: (p) => void (p.shots = clone(before))
  }
}

export function addShot(shots: Shot[], shot: Shot, index: number): Command {
  const after = [...shots]
  after.splice(index, 0, shot)
  return replaceShots('New shot', shots, after)
}

export function deleteShot(shots: Shot[], id: string): Command {
  const shot = shots.find((s) => s.id === id)
  return replaceShots(`Delete shot ${shot?.number ?? ''}`.trim(), shots, shots.filter((s) => s.id !== id))
}

export function moveShot(shots: Shot[], id: string, toIndex: number): Command {
  const from = shots.findIndex((s) => s.id === id)
  const after = [...shots]
  const [moved] = after.splice(from, 1)
  after.splice(Math.min(toIndex, after.length), 0, moved)
  return replaceShots(`Move shot ${moved.number}`, shots, after)
}

type ShotPatch = Partial<Pick<Shot, 'number' | 'numberLocked' | 'type' | 'duration' | 'notes' | 'fields'>>

interface ShotPatchCommand extends Command {
  readonly after: ShotPatch
}

/** Edit a shot's details (number, type, duration, notes, custom fields). Rapid edits merge. */
export function updateShot(shotId: string, before: ShotPatch, after: ShotPatch, label = 'Edit shot', mergeable = true): ShotPatchCommand {
  const apply = (patch: ShotPatch) => (p: Project) => {
    const shot = p.shots.find((s) => s.id === shotId)
    if (shot) Object.assign(shot, clone(patch))
  }
  const mergeKey = mergeable ? `shot:${shotId}:${Object.keys(after).sort().join(',')}` : undefined
  return {
    label,
    after,
    shotId,
    mergeKey,
    do: apply(after),
    undo: apply(before),
    merge: (next) =>
      mergeKey && next.mergeKey === mergeKey ? updateShot(shotId, before, (next as ShotPatchCommand).after, label) : null
  }
}

export function setColumns(before: ColumnDef[], after: ColumnDef[], label = 'Change columns'): Command {
  return {
    label,
    do: (p) => void (p.shotColumns = clone(after)),
    undo: (p) => void (p.shotColumns = clone(before))
  }
}

export function renameProject(before: string, after: string): Command {
  return {
    label: 'Rename project',
    do: (p) => void (p.title = after),
    undo: (p) => void (p.title = before)
  }
}
