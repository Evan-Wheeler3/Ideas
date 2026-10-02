import type { Draft } from 'immer'
import type { Camera, Project } from '../shared/types'
import type { Command } from './command'

const clone = <T>(v: T): T => structuredClone(v)

function shotOf(p: Draft<Project>, shotId: string) {
  const shot = p.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot ${shotId} not found`)
  return shot
}

interface PatchCommand<T> extends Command {
  readonly after: Partial<T>
}

/** Change shot camera fields. Rapid edits to the same fields merge into one undo step. */
export function updateCamera(
  shotId: string,
  before: Partial<Camera>,
  after: Partial<Camera>,
  label = 'Edit camera',
  mergeable = true
): PatchCommand<Camera> {
  const mergeKey = mergeable ? `camera:${shotId}:${Object.keys(after).sort().join(',')}` : undefined
  return {
    label,
    after,
    shotId,
    mergeKey,
    do: (p) => void Object.assign(shotOf(p, shotId).camera, clone(after)),
    undo: (p) => void Object.assign(shotOf(p, shotId).camera, clone(before)),
    merge: (next) =>
      mergeKey && next.mergeKey === mergeKey
        ? updateCamera(shotId, before, (next as PatchCommand<Camera>).after, label)
        : null
  }
}

type Settings = Project['settings']

export function updateSettings(before: Partial<Settings>, after: Partial<Settings>, label = 'Change settings'): Command {
  return {
    label,
    do: (p) => void Object.assign(p.settings, clone(after)),
    undo: (p) => void Object.assign(p.settings, clone(before))
  }
}
