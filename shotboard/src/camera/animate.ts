// Where the shot camera is at time t: interpolate between keyframes, then add handheld shake.
// Pure functions, so playback, thumbnails and export all agree frame for frame.
import { Euler, MathUtils, Quaternion } from 'three'
import type { Camera, CameraKey, Ease, Shake, Shot, Vec3 } from '../shared/types'

/** Camera pose and the lens values that can be keyed. */
export interface CameraPose {
  position: Vec3
  rotation: Vec3
  focalLength: number
  focusDistance: number
}

/* ---------------- easing ---------------- */

/** Easing presets as CSS-style cubic-bezier control points (x1, y1, x2, y2). */
export const EASES: Record<Ease, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1]
}

export const EASE_LABELS: Record<Ease, string> = {
  linear: 'Linear',
  easeIn: 'Ease in',
  easeOut: 'Ease out',
  easeInOut: 'Ease in & out'
}

/** Solve a cubic-bezier timing curve at x (0..1), the way browsers do: Newton steps, then bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  let t = x
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x
    if (Math.abs(err) < 1e-6) return sampleY(t)
    const d = slopeX(t)
    if (Math.abs(d) < 1e-6) break
    t -= err / d
  }
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 40; i++) {
    const v = sampleX(t)
    if (Math.abs(v - x) < 1e-6) break
    if (v < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return sampleY(t)
}

export const ease = (e: Ease, u: number): number => {
  const [a, b, c, d] = EASES[e] ?? EASES.linear
  return cubicBezier(a, b, c, d, u)
}

/* ---------------- interpolation helpers ---------------- */

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** Catmull-Rom through p1→p2 with neighbours p0, p3: a smooth path through every key. */
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const u2 = u * u
  const u3 = u2 * u
  return [0, 1, 2].map(
    (i) =>
      0.5 *
      (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3)
  ) as Vec3
}

const toQuat = (r: Vec3) =>
  new Quaternion().setFromEuler(new Euler(r[0] * MathUtils.DEG2RAD, r[1] * MathUtils.DEG2RAD, r[2] * MathUtils.DEG2RAD, 'YXZ'))

function fromQuat(q: Quaternion): Vec3 {
  const e = new Euler().setFromQuaternion(q, 'YXZ')
  return [e.x * MathUtils.RAD2DEG, e.y * MathUtils.RAD2DEG, e.z * MathUtils.RAD2DEG]
}

/** Zooms look even when focal length changes geometrically (35→50→70), not linearly. */
const lerpFocal = (a: number, b: number, u: number) => Math.exp(lerp(Math.log(a), Math.log(b), u))
/** Focus pulls look natural when interpolated in 1/distance, like a lens's focus ring. */
const lerpFocus = (a: number, b: number, u: number) => 1 / lerp(1 / a, 1 / b, u)

/* ---------------- shake ---------------- */

/** Smooth pseudo-random wobble in -1..1: a few sines at unrelated frequencies with seeded phases. */
function wobble(t: number, seed: number, channel: number): number {
  let v = 0
  const freqs = [0.37, 0.91, 1.73, 3.1]
  const weights = [0.45, 0.3, 0.17, 0.08]
  for (let i = 0; i < freqs.length; i++) {
    const phase = Math.sin(seed * 12.9898 + channel * 78.233 + i * 37.719) * 43758.5453
    v += weights[i] * Math.sin(2 * Math.PI * freqs[i] * t * 1.6 + phase)
  }
  return v
}

/** Handheld offsets at time t: position in metres, rotation in degrees. */
export function shakeAt(shake: Shake, t: number): { position: Vec3; rotation: Vec3 } {
  const k = shake.intensity
  if (!k) return { position: [0, 0, 0], rotation: [0, 0, 0] }
  const pos = 0.025 * k
  const rot = 1.2 * k
  return {
    position: [wobble(t, shake.seed, 0) * pos, wobble(t, shake.seed, 1) * pos * 0.7, wobble(t, shake.seed, 2) * pos * 0.5],
    rotation: [wobble(t, shake.seed, 3) * rot, wobble(t, shake.seed, 4) * rot, wobble(t, shake.seed, 5) * rot * 0.5]
  }
}

/* ---------------- evaluation ---------------- */

export const poseOf = (c: Camera | CameraKey): CameraPose => ({
  position: c.position,
  rotation: c.rotation,
  focalLength: c.focalLength,
  focusDistance: c.focusDistance
})

/** The keyed pose at time t (no shake). With no keys, the shot's static camera. */
export function keyedPose(shot: Pick<Shot, 'camera' | 'keys'>, t: number): CameraPose {
  const keys = shot.keys
  if (keys.length === 0) return poseOf(shot.camera)
  if (keys.length === 1 || t <= keys[0].t) return poseOf(keys[0])
  const last = keys[keys.length - 1]
  if (t >= last.t) return poseOf(last)

  let i = 0
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[i + 1]
  const span = b.t - a.t
  const u = span > 0 ? ease(a.ease, (t - a.t) / span) : 1
  const before = keys[Math.max(i - 1, 0)]
  const after = keys[Math.min(i + 2, keys.length - 1)]
  return {
    position: catmullRom(before.position, a.position, b.position, after.position, u),
    rotation: fromQuat(toQuat(a.rotation).slerp(toQuat(b.rotation), u)),
    focalLength: lerpFocal(a.focalLength, b.focalLength, u),
    focusDistance: lerpFocus(Math.max(a.focusDistance, 0.01), Math.max(b.focusDistance, 0.01), u)
  }
}

/** The full camera at time t: keyed move plus shake, with the shot's fixed lens settings. */
export function cameraAt(shot: Pick<Shot, 'camera' | 'keys' | 'shake'>, t: number): Camera {
  const pose = keyedPose(shot, t)
  const s = shakeAt(shot.shake, t)
  return {
    ...shot.camera,
    ...pose,
    position: [pose.position[0] + s.position[0], pose.position[1] + s.position[1], pose.position[2] + s.position[2]],
    rotation: [pose.rotation[0] + s.rotation[0], pose.rotation[1] + s.rotation[1], pose.rotation[2] + s.rotation[2]]
  }
}

/** Points along the camera's path, for drawing it in the editor. */
export function cameraPath(shot: Pick<Shot, 'camera' | 'keys'>, samples = 48): Vec3[] {
  if (shot.keys.length < 2) return []
  const t0 = shot.keys[0].t
  const t1 = shot.keys[shot.keys.length - 1].t
  return Array.from({ length: samples + 1 }, (_, i) => keyedPose(shot, t0 + ((t1 - t0) * i) / samples).position)
}

/** Snap a time to the nearest frame. */
export const snapToFrame = (t: number, fps: number): number => Math.round(t * fps) / fps
