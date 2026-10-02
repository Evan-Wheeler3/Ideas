// A press that turns into a drag (orbiting, panning, a gizmo move) ends with a "click" on
// whatever is under the cursor. These helpers let click handlers ignore those.
const down = { x: 0, y: 0 }
const DRAG_PX = 5

export function notePointerDown(e: { clientX: number; clientY: number }): void {
  down.x = e.clientX
  down.y = e.clientY
}

export function wasDrag(e: { clientX: number; clientY: number }): boolean {
  return Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX
}
