// The built-in sample project: a short diner conversation, broken down into six shots.
import type { Project, SceneObject, Shot, ShotType, Vec3 } from './types'
import { makeCamera, makeFromCatalog, makeProject, makeShot } from './defaults'

function dinerSet(): SceneObject[] {
  return [
    makeFromCatalog('floor', { scale: [12, 1, 12] }),
    makeFromCatalog('wall', { position: [0, 0, -2.4] }),
    makeFromCatalog('window', { position: [-0.9, 0, -2.31] }),
    makeFromCatalog('door', { position: [2.3, 0, -2.3] }),
    makeFromCatalog('counter', { position: [-3.2, 0, -1.2], rotation: [0, 90, 0] }),
    makeFromCatalog('floorLamp', { position: [1.6, 0, -1.8] }),
    makeFromCatalog('table', { position: [0, 0, 0] }),
    makeFromCatalog('cylinder', { name: 'Coffee cup', position: [-0.35, 0.81, 0.1], scale: [0.08, 0.1, 0.08], color: '#e9e2d4' }),
    makeFromCatalog('chair', { name: 'Chair A', position: [-0.95, 0, 0], rotation: [0, 90, 0] }),
    makeFromCatalog('chair', { name: 'Chair B', position: [0.95, 0, 0], rotation: [0, -90, 0] }),
    makeFromCatalog('person-sit', { name: 'Anna', position: [-1.02, 0, 0], rotation: [0, 90, 0], color: '#e0703c' }),
    makeFromCatalog('person-sit', { name: 'Ben', position: [1.02, 0, 0], rotation: [0, -90, 0], color: '#5b8def' })
  ]
}

interface ShotSpec {
  type: ShotType
  from: Vec3
  to: Vec3
  focal: number
  aperture?: number
  dof?: boolean
  duration: number
  notes: string
  cast: string
}

const ANNA_HEAD: Vec3 = [-1.02, 1.2, 0]
const BEN_HEAD: Vec3 = [1.02, 1.2, 0]

const SHOTS: ShotSpec[] = [
  {
    type: 'WS', from: [3.9, 2.4, 5.4], to: [0, 0.8, 0], focal: 24, duration: 4,
    notes: 'Establish the diner. Late night, nearly empty. Anna and Ben face each other across the table.',
    cast: 'Anna, Ben'
  },
  {
    type: 'MS', from: [0, 1.2, 3.4], to: [0, 1.0, 0], focal: 35, duration: 5,
    notes: 'Two-shot, profile. Ben slides the envelope across. Hold for the silence.',
    cast: 'Anna, Ben'
  },
  {
    type: 'OTS', from: [2.05, 1.32, 0.42], to: ANNA_HEAD, focal: 50, aperture: 2.8, dof: true, duration: 4,
    notes: "Over Ben's shoulder onto Anna. She doesn't open it.",
    cast: 'Anna, Ben'
  },
  {
    type: 'CU', from: [0.6, 1.22, 1.5], to: ANNA_HEAD, focal: 50, aperture: 2, dof: true, duration: 3,
    notes: 'Anna: "You came all this way for that?"',
    cast: 'Anna'
  },
  {
    type: 'CU', from: [-0.6, 1.22, 1.5], to: BEN_HEAD, focal: 50, aperture: 2, dof: true, duration: 3,
    notes: 'Ben reacts. A beat too long before he answers.',
    cast: 'Ben'
  },
  {
    type: 'INSERT', from: [-0.1, 1.45, 0.75], to: [-0.35, 0.82, 0.1], focal: 50, aperture: 2.8, dof: true, duration: 2,
    notes: 'The coffee cup. Her hand wraps around it, steadying.',
    cast: 'Anna'
  }
]

export function makeSampleProject(): Project {
  const p = makeProject('Diner Scene')
  p.meta = { production: 'Sample Film', director: 'Director', dp: 'DP' }
  p.shotColumns = [
    ...p.shotColumns,
    { id: 'location', label: 'Location', kind: 'text', visible: true },
    { id: 'cast', label: 'Cast', kind: 'text', visible: true }
  ]
  const set = dinerSet()
  p.shots = SHOTS.map((spec, i): Shot => {
    const shot = makeShot(String(i + 1))
    shot.type = spec.type
    shot.duration = spec.duration
    shot.notes = spec.notes
    shot.fields = { location: 'INT. DINER – NIGHT', cast: spec.cast }
    shot.scene.objects = structuredClone(set)
    shot.camera = {
      ...makeCamera(spec.from, spec.to),
      focalLength: spec.focal,
      aperture: spec.aperture ?? 4,
      dof: spec.dof ?? false
    }
    return shot
  })
  return p
}
