/** Where the framed picture (the "gate") sits inside the viewport in camera view. Always centered. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const GATE_MARGIN_X = 28
export const GATE_MARGIN_Y = 64

export function gateRect(viewW: number, viewH: number, aspect: number): Rect {
  const availW = Math.max(viewW - GATE_MARGIN_X * 2, 50)
  const availH = Math.max(viewH - GATE_MARGIN_Y * 2, 50)
  const [width, height] = availW / availH > aspect ? [availH * aspect, availH] : [availW, availW / aspect]
  return { x: (viewW - width) / 2, y: (viewH - height) / 2, width, height }
}
