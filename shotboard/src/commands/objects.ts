import type { Draft } from 'immer'
import type { Project, SceneObject } from '../shared/types'
import { composite, type Command } from './command'

function shotOf(p: Draft<Project>, shotId: string) {
  const shot = p.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot ${shotId} not found`)
  return shot
}

const clone = <T>(v: T): T => structuredClone(v)

export function addObject(shotId: string, obj: SceneObject, index?: number): Command {
  return {
    label: `Add ${obj.name}`,
    do: (p) => {
      const list = shotOf(p, shotId).scene.objects
      list.splice(index ?? list.length, 0, clone(obj))
    },
    undo: (p) => {
      const list = shotOf(p, shotId).scene.objects
      const i = list.findIndex((o) => o.id === obj.id)
      if (i >= 0) list.splice(i, 1)
    }
  }
}

export function deleteObjects(shotId: string, objects: SceneObject[], allObjects: SceneObject[]): Command {
  // Remember where each object was so undo puts it back in the same place in the list.
  const removed = objects
    .map((o) => ({ obj: clone(o), index: allObjects.findIndex((a) => a.id === o.id) }))
    .filter((r) => r.index >= 0)
    .sort((a, b) => a.index - b.index)
  return {
    label: removed.length === 1 ? `Delete ${removed[0].obj.name}` : `Delete ${removed.length} objects`,
    do: (p) => {
      const ids = new Set(removed.map((r) => r.obj.id))
      const shot = shotOf(p, shotId)
      shot.scene.objects = shot.scene.objects.filter((o) => !ids.has(o.id))
    },
    undo: (p) => {
      const list = shotOf(p, shotId).scene.objects
      for (const r of removed) list.splice(r.index, 0, clone(r.obj))
    }
  }
}

export type ObjectPatch = Partial<Omit<SceneObject, 'id' | 'kind'>>

interface UpdateCommand extends Command {
  readonly after: ObjectPatch
}

/** Change some fields of one object. Repeated edits to the same fields merge into one undo step. */
export function updateObject(
  shotId: string,
  id: string,
  before: ObjectPatch,
  after: ObjectPatch,
  label = 'Edit object',
  mergeable = true
): UpdateCommand {
  const apply = (patch: ObjectPatch) => (p: Draft<Project>) => {
    const obj = shotOf(p, shotId).scene.objects.find((o) => o.id === id)
    if (obj) Object.assign(obj, clone(patch))
  }
  const mergeKey = mergeable ? `update:${shotId}:${id}:${Object.keys(after).sort().join(',')}` : undefined
  return {
    label,
    after,
    mergeKey,
    do: apply(after),
    undo: apply(before),
    merge: (next) =>
      mergeKey && next.mergeKey === mergeKey
        ? updateObject(shotId, id, before, (next as UpdateCommand).after, label)
        : null
  }
}

/** Edit several objects at once, one undo step. */
export function updateObjects(
  shotId: string,
  changes: { id: string; before: ObjectPatch; after: ObjectPatch }[],
  label: string
): Command {
  return composite(
    label,
    changes.map((c) => updateObject(shotId, c.id, c.before, c.after, label, false))
  )
}

export function duplicateObjects(shotId: string, copies: SceneObject[]): Command {
  return composite(
    copies.length === 1 ? `Duplicate ${copies[0].name}` : `Duplicate ${copies.length} objects`,
    copies.map((c) => addObject(shotId, c))
  )
}
