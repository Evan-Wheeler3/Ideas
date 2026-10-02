import { describe, expect, it } from 'vitest'
import { cameraAt, cubicBezier, ease, keyedPose, shakeAt } from '../src/camera/animate'
import { endPose, moveKeys } from '../src/camera/moves'
import { makeCamera } from '../src/shared/defaults'
import type { CameraKey, Shot } from '../src/shared/types'

let n = 0
const id = () => `k${n++}`

function shotWith(keys: CameraKey[], intensity = 0): Pick<Shot, 'camera' | 'keys' | 'shake'> {
  return { camera: makeCamera([0, 1.5, 5], [0, 1.5, 0]), keys, shake: { intensity, seed: 42 } }
}

const key = (t: number, x: number, focal = 35, focus = 5): CameraKey => ({
  id: id(), t, position: [x, 1.5, 5], rotation: [0, 0, 0], focalLength: focal, focusDistance: focus, ease: 'linear'
})

describe('easing', () => {
  it('matches known cubic-bezier values', () => {
    expect(cubicBezier(0, 0, 1, 1, 0.3)).toBeCloseTo(0.3, 5)
    // CSS "ease-in-out" is symmetric and crosses 0.5 at the midpoint.
    expect(ease('easeInOut', 0.5)).toBeCloseTo(0.5, 4)
    expect(ease('easeInOut', 0.25)).toBeCloseTo(0.1291, 3)
    expect(ease('easeIn', 0.5)).toBeLessThan(0.5)
    expect(ease('easeOut', 0.5)).toBeGreaterThan(0.5)
    expect(ease('easeInOut', 0)).toBe(0)
    expect(ease('easeInOut', 1)).toBe(1)
  })
})

describe('camera interpolation', () => {
  it('uses the static camera when there are no keys', () => {
    const s = shotWith([])
    expect(keyedPose(s, 2).position).toEqual(s.camera.position)
  })

  it('hits keys exactly and holds before the first / after the last', () => {
    const s = shotWith([key(1, 0), key(3, 2), key(5, 6)])
    expect(keyedPose(s, 0).position[0]).toBe(0)
    expect(keyedPose(s, 1).position[0]).toBeCloseTo(0)
    expect(keyedPose(s, 3).position[0]).toBeCloseTo(2)
    expect(keyedPose(s, 5).position[0]).toBeCloseTo(6)
    expect(keyedPose(s, 9).position[0]).toBe(6)
  })

  it('moves smoothly between keys', () => {
    const s = shotWith([key(0, 0), key(2, 2)])
    expect(keyedPose(s, 1).position[0]).toBeCloseTo(1)
  })

  it('zooms evenly in log space and pulls focus in 1/distance', () => {
    const s = shotWith([key(0, 0, 25, 2), key(2, 0, 100, 8)])
    expect(keyedPose(s, 1).focalLength).toBeCloseTo(50) // geometric middle of 25 and 100
    expect(keyedPose(s, 1).focusDistance).toBeCloseTo(3.2) // 1 / mean(1/2, 1/8)
  })

  it('shake is deterministic and only applied when on', () => {
    expect(shakeAt({ intensity: 0, seed: 1 }, 1.3)).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] })
    const a = cameraAt(shotWith([], 1), 1.3)
    const b = cameraAt(shotWith([], 1), 1.3)
    expect(a).toEqual(b)
    expect(a.position).not.toEqual(shotWith([]).camera.position)
    // Rough handheld stays within a few centimetres and a couple of degrees.
    for (let t = 0; t < 10; t += 0.1) {
      const s = shakeAt({ intensity: 1, seed: 7 }, t)
      expect(Math.max(...s.position.map(Math.abs))).toBeLessThan(0.05)
      expect(Math.max(...s.rotation.map(Math.abs))).toBeLessThan(2.5)
    }
  })
})

describe('preset moves', () => {
  const start = { position: [0, 1.5, 5] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], focalLength: 35, focusDistance: 5 }

  it('dolly in moves toward the subject and keeps it in focus', () => {
    const end = endPose('dollyIn', start, 1)
    expect(end.position[2]).toBeCloseTo(3.5)
    expect(end.focusDistance).toBeCloseTo(3.5)
  })

  it('never dollies through the subject', () => {
    const end = endPose('dollyIn', { ...start, focusDistance: 1 }, 2)
    expect(end.focusDistance).toBeCloseTo(0.3)
  })

  it('orbit keeps the same distance and keeps looking at the subject', () => {
    const end = endPose('orbitRight', start, 1)
    const dx = end.position[0]
    const dz = end.position[2]
    expect(Math.hypot(dx, dz)).toBeCloseTo(5)
    expect(end.rotation[1]).toBeCloseTo(45, 0)
  })

  it('dolly zoom keeps the subject the same size (focal / distance constant)', () => {
    const end = endPose('dollyZoom', start, 1)
    expect(end.focalLength / end.focusDistance).toBeCloseTo(start.focalLength / start.focusDistance, 3)
  })

  it('builds keys spanning the shot', () => {
    const keys = moveKeys('panLeft', start, 4, 1, id)
    expect(keys.map((k) => k.t)).toEqual([0, 4])
    expect(keys[1].rotation[1]).toBe(30)
  })
})
