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
  /** Shown shot number, e.g. "4" or "12A". Kept in sync with list order unless numberLocked. */
  number: string
  /** The user typed their own number; renumbering leaves it alone. */
  numberLocked: boolean
  type: ShotType
  duration: number
  notes: string
  fields: Record<string, string | number>
  scene: Scene
  camera: Camera
  /** Camera keyframes, sorted by time. Empty = the camera holds still (uses `camera`). */
  keys: CameraKey[]
  /** Procedural handheld shake layered on top of the camera move. */
  shake: Shake
}

export interface Shake {
  /** 0 = off, 1 = rough. */
  intensity: number
  /** Fixed seed, so playback and export always shake the same way. */
  seed: number
}

export type EnvironmentPreset = 'studio' | 'day' | 'overcast' | 'sunset' | 'night' | 'stage'
export type LightingPreset = 'none' | 'golden' | 'overcast' | 'night' | 'threepoint'

export interface Scene {
  objects: SceneObject[]
  environment: Environment
  /** The last lighting preset applied (for the UI); lights it added are tagged with fromPreset. */
  lightingPreset: LightingPreset
}

export interface Environment {
  /** Sky, sun and ambient light. See scene/environments.ts. */
  preset: EnvironmentPreset
  /** Draw a procedural sky (day/sunset) or a flat colour behind the set. */
  background: 'sky' | 'color'
  color: string
  /** Exposure in stops (EV): +1 is twice as bright. */
  exposure: number
}

export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone'
export type ObjectKind = PrimitiveKind | 'prop' | 'mannequin' | 'model' | 'light'

export type PropId =
  | 'chair' | 'table' | 'sofa' | 'bed' | 'counter' | 'floorLamp'
  | 'wall' | 'door' | 'window' | 'car' | 'tree' | 'stairs'

/**
 * A light. It shines along the object's local -Z (rotate it to aim). Area lights take their size
 * from the object's scale (x = width, y = height).
 */
export interface LightSettings {
  type: 'directional' | 'point' | 'spot' | 'area'
  /** Brightness on a 0–10 scale; each type maps it to sensible physical units. */
  intensity: number
  /** Colour temperature in Kelvin (1800 candle … 6500 daylight … 10000 blue sky). */
  kelvin: number
  /** Extra tint, multiplied with the colour temperature. White = none. */
  color: string
  shadows: boolean
  /** Spot cone angle in degrees. */
  angle?: number
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
  /** Set on lights added by a lighting preset, so applying another preset replaces them. */
  fromPreset?: LightingPreset
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

/**
 * A camera keyframe. `ease` shapes the move from this key to the next one.
 * Lens settings other than focal length and focus (sensor, aperture, DoF) come from Shot.camera.
 */
export interface CameraKey {
  id: string
  /** Seconds from the start of the shot. */
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
