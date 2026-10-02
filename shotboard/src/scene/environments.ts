// Environment presets: background, sky, sun (or moon) and ambient light for a whole shot.
import type { EnvironmentPreset } from '../shared/types'

export interface EnvironmentDef {
  label: string
  /** Default flat background colour (also used for fog). */
  color: string
  /** Whether this preset defaults to a procedural sky. */
  sky: boolean
  hemi: { sky: string; ground: string; intensity: number }
  /** Sun / moon: elevation and azimuth in degrees, colour temperature, intensity (lux-ish). */
  sun: { elevation: number; azimuth: number; kelvin: number; intensity: number; softness: number }
  /** Strength of the soft studio reflections (fills shadows a little). */
  reflections: number
  fog: [number, number]
}

export const ENVIRONMENTS: Record<EnvironmentPreset, EnvironmentDef> = {
  studio: {
    label: 'Studio',
    color: '#1b1d22',
    sky: false,
    hemi: { sky: '#d8e0ff', ground: '#2a2622', intensity: 0.45 },
    sun: { elevation: 52, azimuth: 50, kelvin: 5600, intensity: 2.2, softness: 4 },
    reflections: 1,
    fog: [25, 70]
  },
  day: {
    label: 'Day',
    color: '#9fb8d6',
    sky: true,
    hemi: { sky: '#cfe3ff', ground: '#6b5f52', intensity: 0.9 },
    sun: { elevation: 55, azimuth: 35, kelvin: 5800, intensity: 3.2, softness: 2 },
    reflections: 1,
    fog: [40, 160]
  },
  overcast: {
    label: 'Overcast',
    color: '#aeb6bf',
    sky: false,
    hemi: { sky: '#e6ecf2', ground: '#5f5a54', intensity: 1.7 },
    sun: { elevation: 72, azimuth: 20, kelvin: 6800, intensity: 0.55, softness: 12 },
    reflections: 1.4,
    fog: [20, 90]
  },
  sunset: {
    label: 'Sunset',
    color: '#c98559',
    sky: true,
    // Warm low sun, cool blue sky light in the shadows: the classic golden-hour contrast.
    hemi: { sky: '#8fa3d8', ground: '#3a2c26', intensity: 0.6 },
    sun: { elevation: 9, azimuth: -60, kelvin: 3300, intensity: 2.8, softness: 3 },
    reflections: 0.6,
    fog: [30, 120]
  },
  stage: {
    label: 'Dark stage',
    color: '#0c0d10',
    sky: false,
    hemi: { sky: '#b8c0d0', ground: '#151311', intensity: 0.1 },
    sun: { elevation: 60, azimuth: 30, kelvin: 5600, intensity: 0, softness: 4 },
    reflections: 0.15,
    fog: [25, 70]
  },
  night: {
    label: 'Night',
    color: '#05070d',
    sky: false,
    hemi: { sky: '#2a3a66', ground: '#0a0a0c', intensity: 0.16 },
    sun: { elevation: 38, azimuth: 120, kelvin: 8000, intensity: 0.35, softness: 6 },
    reflections: 0.12,
    fog: [15, 60]
  }
}

/** Direction to the sun as a point far away (y up). */
export function sunPosition(elevation: number, azimuth: number, distance = 20): [number, number, number] {
  const el = (elevation * Math.PI) / 180
  const az = (azimuth * Math.PI) / 180
  return [Math.sin(az) * Math.cos(el) * distance, Math.sin(el) * distance, Math.cos(az) * Math.cos(el) * distance]
}
