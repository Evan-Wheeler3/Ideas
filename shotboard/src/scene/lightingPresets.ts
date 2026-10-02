// Lighting presets: an environment plus (for some) a few lights, placed around the subject the
// camera is looking at. Lights a preset adds are tagged with `fromPreset` so the next preset
// replaces them instead of piling up.
import { Vector3 } from 'three'
import type { Camera, EnvironmentPreset, LightingPreset, LightSettings, SceneObject, Vec3 } from '../shared/types'
import { makeFromCatalog } from '../shared/defaults'
import { aimRotation, forwardVector } from '../camera/orient'
import { ENVIRONMENTS } from './environments'

export const LIGHTING_PRESETS: { id: Exclude<LightingPreset, 'none'>; label: string; hint: string }[] = [
  { id: 'golden', label: 'Golden hour', hint: 'Low, warm sun and a glowing sky' },
  { id: 'overcast', label: 'Overcast', hint: 'Soft, even daylight with gentle shadows' },
  { id: 'night', label: 'Night', hint: 'Dark blue ambience, a warm practical and cool moonlight' },
  { id: 'threepoint', label: '3-point', hint: 'Classic key, fill and back light on a dark stage' }
]

const ENV_FOR: Record<Exclude<LightingPreset, 'none'>, EnvironmentPreset> = {
  golden: 'sunset',
  overcast: 'overcast',
  night: 'night',
  threepoint: 'stage'
}

const r2 = (n: number) => Math.round(n * 100) / 100 + 0

/** The point the camera is looking at (its focus point), at a sensible height. */
export function subjectPoint(cam: Pick<Camera, 'position' | 'rotation' | 'focusDistance'>): Vector3 {
  const p = new Vector3(...cam.position).addScaledVector(forwardVector(cam.rotation), cam.focusDistance)
  p.y = Math.min(Math.max(p.y, 0.8), 1.8)
  return p
}

function light(name: string, preset: LightingPreset, at: Vector3, aimAt: Vector3, settings: LightSettings, scale?: Vec3): SceneObject {
  const key = settings.type === 'area' ? 'softbox' : settings.type === 'point' ? 'practical' : settings.type === 'directional' ? 'sun' : 'spot'
  const pos: Vec3 = [r2(at.x), r2(at.y), r2(at.z)]
  return makeFromCatalog(key, {
    name,
    position: pos,
    rotation: aimRotation(pos, [aimAt.x, aimAt.y, aimAt.z]),
    light: settings,
    fromPreset: preset,
    ...(scale ? { scale } : {})
  })
}

/** Where to put a light: `angle` degrees around the subject from the camera side, `dist` away, `rise` above. */
function around(subject: Vector3, toCamera: Vector3, angle: number, dist: number, rise: number): Vector3 {
  const dir = toCamera.clone().applyAxisAngle(new Vector3(0, 1, 0), (angle * Math.PI) / 180)
  return subject.clone().addScaledVector(dir, dist).setY(subject.y + rise)
}

export function presetLook(preset: Exclude<LightingPreset, 'none'>, cam: Camera): { env: EnvironmentPreset; lights: SceneObject[] } {
  const subject = subjectPoint(cam)
  const toCamera = new Vector3(...cam.position).sub(subject).setY(0).normalize()
  if (toCamera.lengthSq() === 0) toCamera.set(0, 0, 1)

  switch (preset) {
    case 'threepoint':
      return {
        env: 'stage',
        lights: [
          light('Key light', preset, around(subject, toCamera, 45, 2.6, 1.1), subject, { type: 'spot', intensity: 5, kelvin: 4300, color: '#ffffff', shadows: true, angle: 40 }),
          light('Fill light', preset, around(subject, toCamera, -55, 2.4, 0.3), subject, { type: 'area', intensity: 2, kelvin: 5200, color: '#ffffff', shadows: false }, [1.4, 1.4, 1]),
          light('Back light', preset, around(subject, toCamera, 165, 2.6, 1.5), subject, { type: 'spot', intensity: 6, kelvin: 6000, color: '#ffffff', shadows: false, angle: 30 })
        ]
      }
    case 'night':
      return {
        env: 'night',
        lights: [
          light('Practical', preset, around(subject, toCamera, 170, 1.4, 0.45), subject, { type: 'point', intensity: 1, kelvin: 2700, color: '#ffffff', shadows: true }),
          light('Moonlight', preset, around(subject, toCamera, -140, 4, 3), subject, { type: 'spot', intensity: 2.6, kelvin: 10000, color: '#c4d4ff', shadows: true, angle: 50 })
        ]
      }
    default:
      return { env: ENV_FOR[preset], lights: [] }
  }
}

/** The environment a preset uses, with its default background. */
export function presetEnvironment(env: EnvironmentPreset, exposure = 0) {
  const def = ENVIRONMENTS[env]
  return { preset: env, background: def.sky ? ('sky' as const) : ('color' as const), color: def.color, exposure }
}
