// High-level editor actions shared by the toolbar, panels and keyboard shortcuts.
import { Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three-stdlib'
import { makeFromCatalog, newId } from '../shared/defaults'
import { catalogItem, PERSON_COLORS } from '../shared/catalog'
import type { SceneObject, Vec3 } from '../shared/types'
import { composite, type Command } from '../commands/command'
import { addObject, deleteObjects, duplicateObjects } from '../commands/objects'
import { updateCamera } from '../commands/project'
import { lookAtRotation } from '../camera/orient'
import { editorView } from '../scene/ShotCameraView'
import { putAsset } from './assets'
import { getActiveShot, useStore } from './store'

const r2 = (n: number) => Math.round(n * 100) / 100

/** Where new things go: the point on the floor the editor view is looking at. */
function placementPoint(): [number, number] {
  return [r2(editorView.target.x), r2(editorView.target.z)]
}

function uniqueName(base: string, objects: SceneObject[]): string {
  const names = new Set(objects.map((o) => o.name))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} ${i}`)) i++
  return `${base} ${i}`
}

export function addFromCatalog(key: string): void {
  const shot = getActiveShot()
  const item = catalogItem(key)
  const [x, z] = item.kind === 'plane' ? [0, 0] : placementPoint()
  const obj = makeFromCatalog(key)
  obj.position = [x, obj.position[1], z]
  obj.name = uniqueName(obj.name, shot.scene.objects)
  if (obj.kind === 'mannequin') {
    // Give each person their own shirt color so they're easy to tell apart.
    const people = shot.scene.objects.filter((o) => o.kind === 'mannequin').length
    obj.color = PERSON_COLORS[people % PERSON_COLORS.length]
  }
  const { run, select } = useStore.getState()
  run(addObject(shot.id, obj))
  select([obj.id])
}

export function deleteSelection(): void {
  const { selection, run, select } = useStore.getState()
  const shot = getActiveShot()
  const objs = shot.scene.objects.filter((o) => selection.includes(o.id))
  if (!objs.length) return
  run(deleteObjects(shot.id, objs, shot.scene.objects))
  select([])
}

export function duplicateSelection(): void {
  const { selection, run, select } = useStore.getState()
  const shot = getActiveShot()
  const copies = shot.scene.objects
    .filter((o) => selection.includes(o.id))
    .map((o) => ({
      ...structuredClone(o),
      id: newId(),
      name: uniqueName(o.name.replace(/ \d+$/, ''), shot.scene.objects),
      position: [o.position[0] + 0.5, o.position[1], o.position[2] + 0.5] as Vec3
    }))
  if (!copies.length) return
  run(duplicateObjects(shot.id, copies))
  select(copies.map((c) => c.id))
}

/** Put the shot camera where the editor view is, looking at the same point. */
export function cameraFromView(): void {
  const shot = getActiveShot()
  const pos: Vec3 = [r2(editorView.position.x), r2(editorView.position.y), r2(editorView.position.z)]
  const target: Vec3 = [editorView.target.x, editorView.target.y, editorView.target.z]
  const focus = r2(editorView.position.distanceTo(editorView.target))
  const before = { position: shot.camera.position, rotation: shot.camera.rotation, focusDistance: shot.camera.focusDistance }
  const after = { position: pos, rotation: lookAtRotation(pos, target), focusDistance: focus }
  useStore.getState().run(updateCamera(shot.id, before, after, 'Camera from view', false))
}

/** Pull focus to an object (distance from the camera to its middle). Optionally aim at it too. */
export function focusOn(objectId: string, aim = false): void {
  const shot = getActiveShot()
  const obj = shot.scene.objects.find((o) => o.id === objectId)
  if (!obj) return
  // Aim for chest/eye height on people, the middle of anything else.
  const height = obj.kind === 'mannequin' ? 1.45 * obj.scale[1] + (obj.pose?.hipsY ?? 0) : obj.position[1] + 0.4 * obj.scale[1]
  const target = new Vector3(obj.position[0], Math.max(height, obj.position[1]), obj.position[2])
  const from = new Vector3(...shot.camera.position)
  const after = {
    focusDistance: r2(from.distanceTo(target)),
    ...(aim ? { rotation: lookAtRotation(shot.camera.position, target.toArray() as Vec3) } : {})
  }
  const before = { focusDistance: shot.camera.focusDistance, ...(aim ? { rotation: shot.camera.rotation } : {}) }
  useStore.getState().run(updateCamera(shot.id, before, after, aim ? `Aim at ${obj.name}` : `Focus on ${obj.name}`, false))
}

/** Import .glb/.gltf files, add them to the project's assets and drop them into the scene. */
export async function importModelFiles(files: File[]): Promise<string[]> {
  const models = files.filter((f) => /\.(glb|gltf)$/i.test(f.name))
  const errors: string[] = []
  const cmds: Command[] = []
  const shot = getActiveShot()
  const added: SceneObject[] = []
  for (const file of models) {
    try {
      const data = await file.arrayBuffer()
      // Parse once to check the file and measure it, so it can sit on the floor.
      const gltf = await new GLTFLoader().parseAsync(data, '')
      const box = new Box3().setFromObject(gltf.scene)
      const id = newId()
      const name = file.name.replace(/\.(glb|gltf)$/i, '')
      putAsset(id, data)
      const [x, z] = placementPoint()
      const obj = makeFromCatalog('box', {
        kind: 'model',
        assetId: id,
        name: uniqueName(name, [...shot.scene.objects, ...added]),
        color: '#ffffff',
        position: [x, box.isEmpty() ? 0 : r2(-box.min.y), z]
      })
      added.push(obj)
      cmds.push({
        label: `Import ${name}`,
        do: (p) => void (p.assets[id] = { id, name, file: `assets/${id}.glb` }),
        undo: (p) => void delete p.assets[id]
      })
      cmds.push(addObject(shot.id, obj))
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (models.length === 0 && files.length) errors.push('Only .glb and .gltf files can be imported.')
  if (cmds.length) {
    const { run, select } = useStore.getState()
    run(composite(added.length === 1 ? `Import ${added[0].name}` : `Import ${added.length} models`, cmds))
    select(added.map((o) => o.id))
  }
  if (errors.length) window.alert(`Some files couldn't be imported:\n\n${errors.join('\n')}`)
  return added.map((o) => o.id)
}

/** Add another copy of an already-imported model. */
export function addImported(assetId: string): void {
  const shot = getActiveShot()
  const asset = useStore.getState().project.assets[assetId]
  if (!asset) return
  const existing = shot.scene.objects.find((o) => o.assetId === assetId)
  const [x, z] = placementPoint()
  const obj = makeFromCatalog('box', {
    kind: 'model',
    assetId,
    name: uniqueName(asset.name, shot.scene.objects),
    color: '#ffffff',
    position: [x, existing?.position[1] ?? 0, z]
  })
  useStore.getState().run(addObject(shot.id, obj))
  useStore.getState().select([obj.id])
}
