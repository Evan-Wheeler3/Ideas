// High-level editor actions shared by the toolbar, panels and keyboard shortcuts.
import { makeObject, newId } from '../shared/defaults'
import type { ObjectKind } from '../shared/types'
import { addObject, deleteObjects, duplicateObjects } from '../commands/objects'
import { getActiveShot, useStore } from './store'

export function addNew(kind: ObjectKind): void {
  const shot = getActiveShot()
  // Count existing objects of this kind so names read "Box", "Box 2", "Box 3"...
  const obj = makeObject(kind)
  const sameKind = shot.scene.objects.filter((o) => o.kind === kind).length
  if (sameKind > 0) obj.name = `${obj.name} ${sameKind + 1}`
  useStore.getState().run(addObject(shot.id, obj))
  useStore.getState().select([obj.id])
}

export function deleteSelection(): void {
  const { selection, run, select } = useStore.getState()
  if (!selection.length) return
  const shot = getActiveShot()
  const objs = shot.scene.objects.filter((o) => selection.includes(o.id))
  run(deleteObjects(shot.id, objs, shot.scene.objects))
  select([])
}

export function duplicateSelection(): void {
  const { selection, run, select } = useStore.getState()
  if (!selection.length) return
  const shot = getActiveShot()
  const copies = shot.scene.objects
    .filter((o) => selection.includes(o.id))
    .map((o) => ({
      ...structuredClone(o),
      id: newId(),
      name: `${o.name} copy`,
      position: [o.position[0] + 0.5, o.position[1], o.position[2] + 0.5] as [number, number, number]
    }))
  run(duplicateObjects(shot.id, copies))
  select(copies.map((c) => c.id))
}
