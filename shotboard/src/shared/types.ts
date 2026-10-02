// Project document types. Everything here is saved in the .shotboard file.
// Units: meters, Y up, seconds. Rotations are Euler XYZ in degrees.

export type Vec3 = [number, number, number]

export const SCHEMA_VERSION = 1

export type AspectRatio = '1.33' | '1.78' | '1.85' | '2.39' | '9:16'

export interface Project {
  schemaVersion: number
  title: string
  meta: { production?: string; director?: string; dp?: string }
  settings: {
    fps: number
    aspect: AspectRatio
    exportWidth: number
  }
  shotColumns: ColumnDef[]
  shots: Shot[]
  assets: Record<string, AssetRef>
}

export interface ColumnDef {
  id: string
  label: string
  kind: 'builtin' | 'text' | 'longtext' | 'select' | 'number'
  options?: string[]
  visible: boolean
  width?: number
}

export type ShotType = 'WS' | 'FS' | 'MS' | 'MCU' | 'CU' | 'ECU' | 'OTS' | 'POV' | 'INSERT' | 'OTHER'

export interface Shot {
  id: string
  number: string
  type: ShotType
  duration: number
  notes: string
  fields: Record<string, string | number>
  scene: Scene
  camera: Camera
  keys: CameraKey[]
  thumbnail?: string
}

export type EnvironmentPreset = 'studio' | 'day' | 'sunset' | 'night'
export type LightingPreset = 'none' | 'golden' | 'overcast' | 'night' | 'threepoint'

export interface Scene {
  objects: SceneObject[]
  environment: { preset: EnvironmentPreset; background: 'sky' | 'color'; color: string }
  lightingPreset: LightingPreset
}

export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone'
export type ObjectKind = PrimitiveKind | 'prop' | 'mannequin' | 'model' | 'light'

export type PropId =
  | 'chair' | 'table' | 'sofa' | 'bed' | 'counter' | 'floorLamp'
  | 'wall' | 'door' | 'window' | 'car' | 'tree' | 'stairs'

export interface LightSettings {
  type: 'directional' | 'point' | 'spot' | 'area'
  intensity: number
  kelvin: number
  color: string
  shadows: boolean
}

export type JointName =
  | 'head' | 'torso'
  | 'armL' | 'armR' | 'forearmL' | 'forearmR'
  | 'legL' | 'legR' | 'shinL' | 'shinR'

export type PosePreset = 'stand' | 'sit' | 'walk' | 'run' | 'point'

export interface Pose {
  preset: PosePreset | 'custom'
  /** Raise or lower the hips, in metres (e.g. sitting). */
  hipsY: number
  joints: Partial<Record<JointName, Vec3>>
}

export interface SceneObject {
  id: string
  name: string
  kind: ObjectKind
  position: Vec3
  rotation: Vec3
  scale: Vec3
  color: string
  visible: boolean
  pose?: Pose
  propId?: PropId
  assetId?: string
  light?: LightSettings
}

export type SensorId = 'super35' | 'fullframe' | 'alexa65' | 'iphone'

export interface Camera {
  position: Vec3
  /** Degrees, applied in YXZ order (pan, then tilt, then roll). */
  rotation: Vec3
  focalLength: number
  sensor: SensorId
  aperture: number
  focusDistance: number
  dof: boolean
}

export type Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface CameraKey {
  t: number
  position: Vec3
  rotation: Vec3
  focalLength: number
  focusDistance: number
  ease: Ease
}

export interface AssetRef {
  id: string
  name: string
  file: string
}
