// Colour temperature (Kelvin) to RGB, after Tanner Helland's fit of the black-body curve.
import { Color } from 'three'

export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100
  const clamp = (v: number) => Math.min(Math.max(v, 0), 255) / 255
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp(r), clamp(g), clamp(b)]
}

/** Light colour from temperature and an optional tint, as a three.js Color (sRGB). */
export function lightColor(kelvin: number, tint = '#ffffff'): Color {
  const [r, g, b] = kelvinToRgb(kelvin)
  return new Color().setRGB(r, g, b, 'srgb').multiply(new Color(tint))
}

export const KELVIN_PRESETS = [
  { label: 'Candle', kelvin: 1900 },
  { label: 'Tungsten', kelvin: 3200 },
  { label: 'Daylight', kelvin: 5600 },
  { label: 'Shade', kelvin: 7500 }
]
