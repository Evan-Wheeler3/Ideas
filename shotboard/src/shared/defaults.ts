import { nanoid } from 'nanoid'
import type { ColumnDef, ObjectKind, Project, SceneObject, Shot } from './types'
import { SCHEMA_VERSION } from './types'

export const newId = (): string => nanoid(10)

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'thumb', label: 'Frame', kind: 'builtin', visible: true },
  { id: 'number', label: '#', kind: 'builtin', visible: true },
  { id: 'type', label: 'Type', kind: 'builtin', visible: true },
  { id: 'lens', label: 'Lens', kind: 'builtin', visible: true },
  { id: 'duration', label: 'Duration', kind: 'builtin', visible: true },
  { id: 'notes', label: 'Notes', kind: 'builtin', visible: true }
]

const PRIMITIVE_DEFAULTS: Record<ObjectKind, Pick<SceneObject, 'name' | 'position' | 'scale' | 'color'>> = {
  box: { name: 'Box', position: [0, 0.5, 0], scale: [1, 1, 1], color: '#8a8f98' },
  sphere: { name: 'Sphere', position: [0, 0.5, 0], scale: [1, 1, 1], color: '#8a8f98' },
  cylinder: { name: 'Cylinder', position: [0, 0.5, 0], scale: [1, 1, 1], color: '#8a8f98' },
  cone: { name: 'Cone', position: [0, 0.5, 0], scale: [1, 1, 1], color: '#8a8f98' },
  plane: { name: 'Plane', position: [0, 0, 0], scale: [2, 1, 2], color: '#6b7078' },
  mannequin: { name: 'Person', position: [0, 0, 0], scale: [1, 1, 1], color: '#c9b8a3' },
  model: { name: 'Model', position: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff' },
  light: { name: 'Light', position: [2, 3, 2], scale: [1, 1, 1], color: '#ffffff' }
}

export function makeObject(kind: ObjectKind, overrides: Partial<SceneObject> = {}): SceneObject {
  const d = PRIMITIVE_DEFAULTS[kind]
  return {
    id: newId(),
    kind,
    name: d.name,
    position: [...d.position],
    rotation: [0, 0, 0],
    scale: [...d.scale],
    color: d.color,
    visible: true,
    ...overrides
  }
}

export function makeShot(number: string): Shot {
  return {
    id: newId(),
    number,
    type: 'WS',
    duration: 3,
    notes: '',
    fields: {},
    scene: {
      objects: [],
      environment: { preset: 'studio', background: 'color', color: '#1b1d22' },
      lightingPreset: 'none'
    },
    camera: {
      position: [0, 1.6, 6],
      rotation: [0, 0, 0],
      focalLength: 35,
      sensor: 'super35',
      aperture: 2.8,
      focusDistance: 6,
      dof: false
    },
    keys: []
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

/** A small starter set so a new project isn't an empty void. */
export function makeStarterProject(): Project {
  const p = makeProject('Untitled')
  p.shots[0].scene.objects = [
    makeObject('plane', { name: 'Floor', scale: [12, 1, 12], color: '#3a3d44' }),
    makeObject('box', { name: 'Table', position: [0, 0.38, 0], scale: [1.6, 0.76, 0.9], color: '#7a5c44' }),
    makeObject('cylinder', { name: 'Stool', position: [-1.3, 0.3, 0.2], scale: [0.4, 0.6, 0.4], color: '#9a3b34' }),
    makeObject('sphere', { name: 'Lamp', position: [1.1, 1.2, -0.6], scale: [0.35, 0.35, 0.35], color: '#e8d9b5' })
  ]
  return p
}
