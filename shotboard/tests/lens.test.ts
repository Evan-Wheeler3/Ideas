import { describe, expect, it } from 'vitest'
import { activeArea, blurDiameter, canvasFov, circleOfConfusion, depthOfField, fieldOfView } from '../src/camera/lens'

describe('lens math', () => {
  it('crops the sensor to the delivery aspect ratio', () => {
    // Full frame (1.5:1) to 2.39: keeps full width, crops height.
    expect(activeArea('fullframe', '2.39').width).toBeCloseTo(36)
    expect(activeArea('fullframe', '2.39').height).toBeCloseTo(36 / 2.39)
    // Full frame to 9:16 vertical: keeps full height, crops width.
    expect(activeArea('fullframe', '9:16').height).toBeCloseTo(24)
    expect(activeArea('fullframe', '9:16').width).toBeCloseTo(24 * 9 / 16)
  })

  it('matches reference field-of-view values', () => {
    const fov = fieldOfView(35, 'fullframe', '2.39')
    expect(fov.h).toBeCloseTo(54.43, 1)
    expect(fov.v).toBeCloseTo(24.29, 1)
    // 50mm on full frame cropped to 4:3 keeps the full 24mm height: 27° vertical.
    expect(fieldOfView(50, 'fullframe', '1.33').v).toBeCloseTo(26.99, 1)
  })

  it('computes depth of field like standard DoF calculators', () => {
    // 50mm f/2.8 at 3m on full frame (CoC ≈ 0.0288mm): about 2.73m to 3.33m.
    expect(circleOfConfusion('fullframe')).toBeCloseTo(0.0288, 3)
    const dof = depthOfField({ focalLength: 50, aperture: 2.8, focusDistance: 3, sensor: 'fullframe' })
    expect(dof.near).toBeCloseTo(2.73, 1)
    expect(dof.far).toBeCloseTo(3.33, 1)
    expect(dof.hyperfocal).toBeCloseTo(31.05, 0)
  })

  it('returns infinite far focus past the hyperfocal distance', () => {
    const dof = depthOfField({ focalLength: 24, aperture: 11, focusDistance: 5, sensor: 'fullframe' })
    expect(dof.far).toBe(Infinity)
  })

  it('makes wide-open long lenses blur the background more', () => {
    const portrait = blurDiameter({ focalLength: 85, aperture: 1.4, focusDistance: 2 }, Infinity)
    const wide = blurDiameter({ focalLength: 24, aperture: 11, focusDistance: 2 }, Infinity)
    expect(portrait).toBeGreaterThan(wide * 50)
    expect(blurDiameter({ focalLength: 50, aperture: 2, focusDistance: 3 }, 3)).toBe(0)
  })

  it('widens the render FOV so the gate fits inside a larger canvas', () => {
    expect(canvasFov(30, 1000, 1000)).toBeCloseTo(30)
    expect(canvasFov(30, 1000, 500)).toBeGreaterThan(55)
  })
})
