// Real-camera lens math. Lengths in millimetres unless noted; distances to subjects in metres.
import type { AspectRatio, Camera, SensorId } from '../shared/types'

export interface Sensor {
  id: SensorId
  label: string
  width: number
  height: number
}

export const SENSORS: Record<SensorId, Sensor> = {
  super35: { id: 'super35', label: 'Super 35', width: 24.89, height: 18.66 },
  fullframe: { id: 'fullframe', label: 'Full Frame', width: 36, height: 24 },
  alexa65: { id: 'alexa65', label: 'Alexa 65', width: 54.12, height: 25.58 },
  iphone: { id: 'iphone', label: 'iPhone (main)', width: 9.8, height: 7.3 }
}

export const ASPECTS: { id: AspectRatio; label: string; value: number }[] = [
  { id: '2.39', label: '2.39 Scope', value: 2.39 },
  { id: '1.85', label: '1.85 Flat', value: 1.85 },
  { id: '1.78', label: '16:9', value: 16 / 9 },
  { id: '1.33', label: '4:3', value: 4 / 3 },
  { id: '9:16', label: '9:16 Vertical', value: 9 / 16 }
]

export const aspectValue = (a: AspectRatio): number => ASPECTS.find((x) => x.id === a)?.value ?? 2.39

export const FOCAL_PRESETS = [14, 18, 24, 35, 50, 85, 135]
export const APERTURE_PRESETS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16]

/** The part of the sensor used for the delivery aspect ratio (cropped top/bottom or sides). */
export function activeArea(sensor: SensorId, aspect: AspectRatio): { width: number; height: number } {
  const s = SENSORS[sensor]
  const a = aspectValue(aspect)
  return s.width / s.height > a ? { width: s.height * a, height: s.height } : { width: s.width, height: s.width / a }
}

const toDeg = (r: number) => (r * 180) / Math.PI

/** Field of view in degrees. */
export function fieldOfView(focalLength: number, sensor: SensorId, aspect: AspectRatio): { h: number; v: number } {
  const { width, height } = activeArea(sensor, aspect)
  return {
    h: toDeg(2 * Math.atan(width / (2 * focalLength))),
    v: toDeg(2 * Math.atan(height / (2 * focalLength)))
  }
}

/** Acceptable circle of confusion: sensor diagonal / 1500 (the Zeiss rule). */
export function circleOfConfusion(sensor: SensorId): number {
  const s = SENSORS[sensor]
  return Math.hypot(s.width, s.height) / 1500
}

/** Near and far limits of acceptable focus, in metres. `far` is Infinity past the hyperfocal distance. */
export function depthOfField(cam: Pick<Camera, 'focalLength' | 'aperture' | 'focusDistance' | 'sensor'>): {
  near: number
  far: number
  hyperfocal: number
} {
  const f = cam.focalLength
  const s = cam.focusDistance * 1000
  const H = (f * f) / (cam.aperture * circleOfConfusion(cam.sensor)) + f
  const near = (s * (H - f)) / (H + s - 2 * f)
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s)
  return { near: near / 1000, far: far / 1000, hyperfocal: H / 1000 }
}

/**
 * Diameter of the blur disc on the sensor (mm) for a point at `distance` metres,
 * when focused at cam.focusDistance. Infinity distance gives the background blur.
 */
export function blurDiameter(cam: Pick<Camera, 'focalLength' | 'aperture' | 'focusDistance'>, distance: number): number {
  const f = cam.focalLength
  const s = Math.max(cam.focusDistance * 1000, f * 1.01)
  const k = (f * f) / (cam.aperture * (s - f))
  if (!Number.isFinite(distance)) return k
  const d = distance * 1000
  return (k * Math.abs(d - s)) / d
}

/**
 * Vertical FOV for a render camera whose canvas is `canvasHeight` px tall when the film gate
 * (the framed picture) is drawn `gateHeight` px tall inside it. Lets us show masks around the gate.
 */
export function canvasFov(gateVFovDeg: number, canvasHeight: number, gateHeight: number): number {
  const half = (gateVFovDeg * Math.PI) / 360
  return toDeg(2 * Math.atan(Math.tan(half) * (canvasHeight / gateHeight)))
}

export const formatDistance = (m: number): string =>
  !Number.isFinite(m) ? '∞' : m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(m < 10 ? 2 : 1)} m`

export const lensLabel = (cam: Pick<Camera, 'focalLength' | 'aperture'>): string =>
  `${Math.round(cam.focalLength)}mm f/${cam.aperture}`

/** Lens label for a whole shot: shows the range of focal lengths when the move zooms. */
export function shotLensLabel(shot: { camera: Pick<Camera, 'focalLength' | 'aperture'>; keys: { focalLength: number }[] }): string {
  if (!shot.keys.length) return lensLabel(shot.camera)
  const focals = shot.keys.map((k) => Math.round(k.focalLength))
  const lo = Math.min(...focals)
  const hi = Math.max(...focals)
  return `${lo === hi ? lo : `${lo}–${hi}`}mm f/${shot.camera.aperture}`
}
