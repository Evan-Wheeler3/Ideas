import { describe, expect, it } from 'vitest'
import { Euler, MathUtils, Vector3 } from 'three'
import { kelvinToRgb } from '../src/scene/kelvin'
import { presetLook, subjectPoint } from '../src/scene/lightingPresets'
import { ENVIRONMENTS } from '../src/scene/environments'
import { aimRotation } from '../src/camera/orient'
import { makeCamera } from '../src/shared/defaults'

const forwardXYZ = (r: [number, number, number]) =>
  new Vector3(0, 0, -1).applyEuler(new Euler(MathUtils.degToRad(r[0]), MathUtils.degToRad(r[1]), MathUtils.degToRad(r[2]), 'XYZ'))

describe('colour temperature', () => {
  it('is warm when low, neutral near 6600K and blue when high', () => {
    const [r1, , b1] = kelvinToRgb(2000)
    expect(r1).toBe(1)
    expect(b1).toBeLessThan(0.2)
    const neutral = kelvinToRgb(6600)
    for (const c of neutral) expect(c).toBeGreaterThan(0.95)
    const [r3, , b3] = kelvinToRgb(10000)
    expect(b3).toBe(1)
    expect(r3).toBeLessThan(0.85)
  })
})

describe('aiming', () => {
  it('points an object -Z axis at the target', () => {
    const from: [number, number, number] = [2, 3, 2]
    const to: [number, number, number] = [0, 1, 0]
    const dir = new Vector3(...to).sub(new Vector3(...from)).normalize()
    expect(forwardXYZ(aimRotation(from, to)).dot(dir)).toBeGreaterThan(0.999)
  })
})

describe('lighting presets', () => {
  const cam = makeCamera([0, 1.5, 5], [0, 1.1, 0])

  it('3-point adds key, fill and back lights around the subject, all aimed at it', () => {
    const { env, lights } = presetLook('threepoint', cam)
    expect(env).toBe('stage')
    expect(lights.map((l) => l.name)).toEqual(['Key light', 'Fill light', 'Back light'])
    const subject = subjectPoint(cam)
    for (const l of lights) {
      expect(l.fromPreset).toBe('threepoint')
      const dir = subject.clone().sub(new Vector3(...l.position)).normalize()
      expect(forwardXYZ(l.rotation).dot(dir)).toBeGreaterThan(0.99)
    }
    // The back light sits behind the subject (away from the camera); the key is on the camera's side.
    expect(lights[2].position[2]).toBeLessThan(subject.z)
    expect(lights[0].position[2]).toBeGreaterThan(subject.z)
  })

  it('daylight presets only change the environment', () => {
    expect(presetLook('overcast', cam)).toEqual({ env: 'overcast', lights: [] })
    expect(presetLook('golden', cam).env).toBe('sunset')
  })

  it('every environment preset is complete', () => {
    for (const def of Object.values(ENVIRONMENTS)) {
      expect(def.fog[1]).toBeGreaterThan(def.fog[0])
      expect(def.hemi.intensity).toBeGreaterThan(0)
    }
  })
})
