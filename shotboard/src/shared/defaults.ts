import { nanoid } from 'nanoid'
import type { Camera, ColumnDef, ObjectKind, Project, SceneObject, Shot, Vec3 } from './types'
import { SCHEMA_VERSION } from './types'
import { catalogItem, CATALOG } from './catalog'
import { clonePose } from './poses'
import { lookAtRotation } from '../camera/orient'

export const newId = (): string => nanoid(10)

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'thumb', label: 'Frame', kind: 'builtin', visible: true },
  { id: 'number', label: '#', kind: 'builtin', visible: true },
  { id: 'type', label: 'Type', kind: 'builtin', visible: true },
  { id: 'lens', label: 'Lens', kind: 'builtin', visible: true },
  { id: 'duration', label: 'Duration', kind: 'builtin', visible: true },
  { id: 'notes', label: 'Notes', kind: 'builtin', visible: true }
]

/** Create an object from a catalog entry (see catalog.ts). */
export function makeFromCatalog(key: string, overrides: Partial<SceneObject> = {}): SceneObject {
  const item = catalogItem(key)
  return {
    id: newId(),
    kind: item.kind,
    name: item.label === 'Seated' ? 'Person' : item.label,
    position: [0, item.y ?? 0, 0],
    rotation: [0, 0, 0],
    scale: item.scale ? [...item.scale] : [1, 1, 1],
    color: item.color,
    visible: true,
    ...(item.propId ? { propId: item.propId } : {}),
    ...(item.kind === 'mannequin' ? { pose: clonePose(item.pose ?? 'stand') } : {}),
    ...(item.light ? { light: { ...item.light } } : {}),
    ...overrides
  }
}

/** Create a basic object by kind (shapes, or the first catalog entry of that kind). */
export function makeObject(kind: ObjectKind, overrides: Partial<SceneObject> = {}): SceneObject {
  const item = CATALOG.find((c) => c.kind === kind && c.category === 'shapes') ?? CATALOG.find((c) => c.kind === kind)
  if (!item) throw new Error(`No catalog entry for ${kind}`)
  return makeFromCatalog(item.key, overrides)
}

export function makeCamera(position: Vec3 = [0, 1.6, 6], target: Vec3 = [0, 1, 0]): Camera {
  const d = Math.hypot(target[0] - position[0], target[1] - position[1], target[2] - position[2])
  return {
    position,
    rotation: lookAtRotation(position, target),
    focalLength: 35,
    sensor: 'super35',
    aperture: 2.8,
    focusDistance: Math.round(d * 100) / 100,
    dof: false
  }
}

export function makeShot(number: string): Shot {
  return {
    id: newId(),
    number,
    numberLocked: false,
    type: 'WS',
    duration: 3,
    notes: '',
    fields: {},
    scene: {
      objects: [],
      environment: { preset: 'studio', background: 'color', color: '#1b1d22', exposure: 0 },
      lightingPreset: 'none'
    },
    camera: makeCamera(),
    keys: [],
    shake: { intensity: 0, seed: Math.floor(Math.random() * 10000) }
  }
}

export function makeProject(title = 'Untitled'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    title,
    meta: {},
    settings: { fps: 24, aspect: '2.39', exportWidth: 1920 },
    shotColumns: DEFAULT_COLUMNS.map((c) => ({ ...c })),
    shots: [makeShot('1')],
    assets: {}
  }
}

/** A small diner-style set, so a new project starts with something to frame. */
export function makeStarterProject(): Project {
  const p = makeProject('Untitled')
  const shot = p.shots[0]
  shot.scene.objects = [
    makeFromCatalog('floor', { scale: [12, 1, 12] }),
    makeFromCatalog('wall', { position: [0, 0, -2.4] }),
    makeFromCatalog('door', { position: [2.3, 0, -2.3] }),
    makeFromCatalog('floorLamp', { position: [-2.2, 0, -1.7] }),
    makeFromCatalog('table', { position: [0, 0, 0] }),
    makeFromCatalog('chair', { name: 'Chair A', position: [-0.95, 0, 0], rotation: [0, 90, 0] }),
    makeFromCatalog('chair', { name: 'Chair B', position: [0.95, 0, 0], rotation: [0, -90, 0] }),
    makeFromCatalog('person-sit', { name: 'Anna', position: [-1.02, 0, 0], rotation: [0, 90, 0] }),
    makeFromCatalog('person', { name: 'Ben', position: [1.7, 0, 0.7], rotation: [0, -115, 0] })
  ]
  shot.camera = makeCamera([0.9, 1.45, 5.4], [0.4, 1.0, 0.2])
  shot.type = 'MS'
  return p
}

/** "New project": an empty stage with one person and the camera on them. */
export function makeBlankProject(): Project {
  const p = makeProject('Untitled')
  const shot = p.shots[0]
  shot.scene.objects = [makeFromCatalog('floor', { scale: [12, 1, 12] }), makeFromCatalog('person', { name: 'Person' })]
  shot.camera = makeCamera([0, 1.5, 4.5], [0, 1.1, 0])
  shot.type = 'FS'
  return p
}
