// Preset camera moves. Each one builds a start key (the camera as it is now) and an end key,
// spanning the whole shot. `amount` scales the move (1 = a typical, moderate move).
import { Vector3 } from 'three'
import type { CameraKey, Ease, Vec3 } from '../shared/types'
import type { CameraPose } from './animate'
import { forwardVector, lookAtRotation } from './orient'

export type MoveId =
  | 'dollyIn' | 'dollyOut' | 'truckLeft' | 'truckRight' | 'panLeft' | 'panRight' | 'tiltUp' | 'tiltDown'
  | 'craneUp' | 'craneDown' | 'orbitLeft' | 'orbitRight' | 'zoomIn' | 'dollyZoom'

export interface MoveDef {
  id: MoveId
  label: string
  hint: string
}

export const MOVES: MoveDef[] = [
  { id: 'dollyIn', label: 'Dolly in', hint: 'Move toward the subject' },
  { id: 'dollyOut', label: 'Dolly out', hint: 'Move away from the subject' },
  { id: 'truckLeft', label: 'Truck left', hint: 'Slide sideways to the left' },
  { id: 'truckRight', label: 'Truck right', hint: 'Slide sideways to the right' },
  { id: 'panLeft', label: 'Pan left', hint: 'Turn left on the spot' },
  { id: 'panRight', label: 'Pan right', hint: 'Turn right on the spot' },
  { id: 'tiltUp', label: 'Tilt up', hint: 'Tip up on the spot' },
  { id: 'tiltDown', label: 'Tilt down', hint: 'Tip down on the spot' },
  { id: 'craneUp', label: 'Crane up', hint: 'Rise, keeping the subject framed' },
  { id: 'craneDown', label: 'Crane down', hint: 'Lower, keeping the subject framed' },
  { id: 'orbitLeft', label: 'Orbit left', hint: 'Arc around the subject' },
  { id: 'orbitRight', label: 'Orbit right', hint: 'Arc around the subject' },
  { id: 'zoomIn', label: 'Zoom in', hint: 'Longer focal length, camera stays put' },
  { id: 'dollyZoom', label: 'Dolly zoom', hint: 'Push in while zooming out: the "Vertigo" effect' }
]

const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0
const vec = (v: Vector3): Vec3 => [r3(v.x), r3(v.y), r3(v.z)]

/** The end pose of a move that starts at `p`. */
export function endPose(move: MoveId, p: CameraPose, amount = 1): CameraPose {
  const pos = new Vector3(...p.position)
  const fwd = forwardVector(p.rotation)
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
  // What the camera is looking at: the focus point.
  const subject = pos.clone().addScaledVector(fwd, p.focusDistance)
  const dist = 1.5 * amount
  const end: CameraPose = { ...p }

  const moveBy = (offset: Vector3) => {
    const np = pos.clone().add(offset)
    end.position = vec(np)
    return np
  }

  switch (move) {
    case 'dollyIn':
    case 'dollyOut': {
      // Never dolly through the subject: stop at 30 cm in front of it.
      const d = move === 'dollyIn' ? Math.min(dist, p.focusDistance - 0.3) : -dist
      moveBy(fwd.clone().multiplyScalar(d))
      end.focusDistance = r3(p.focusDistance - d)
      break
    }
    case 'truckLeft':
    case 'truckRight':
      moveBy(right.clone().multiplyScalar(move === 'truckLeft' ? -dist : dist))
      break
    case 'panLeft':
    case 'panRight':
      end.rotation = [p.rotation[0], r3(p.rotation[1] + (move === 'panLeft' ? 30 : -30) * amount), p.rotation[2]]
      break
    case 'tiltUp':
    case 'tiltDown':
      end.rotation = [r3(Math.max(-85, Math.min(85, p.rotation[0] + (move === 'tiltUp' ? 15 : -15) * amount))), p.rotation[1], p.rotation[2]]
      break
    case 'craneUp':
    case 'craneDown': {
      const np = moveBy(new Vector3(0, move === 'craneUp' ? dist : -Math.min(dist, p.position[1] - 0.3), 0))
      end.rotation = lookAtRotation(vec(np), vec(subject))
      end.focusDistance = r3(np.distanceTo(subject))
      break
    }
    case 'orbitLeft':
    case 'orbitRight': {
      const angle = ((move === 'orbitLeft' ? -45 : 45) * amount * Math.PI) / 180
      const offset = pos.clone().sub(subject).applyAxisAngle(new Vector3(0, 1, 0), angle)
      const np = subject.clone().add(offset)
      end.position = vec(np)
      end.rotation = lookAtRotation(vec(np), vec(subject))
      break
    }
    case 'zoomIn':
      end.focalLength = r3(p.focalLength * (1 + 0.6 * amount))
      break
    case 'dollyZoom': {
      // Push in by d and widen the lens so the subject stays the same size: f2 = f1·(s−d)/s.
      const d = Math.min(dist, p.focusDistance * 0.6)
      moveBy(fwd.clone().multiplyScalar(d))
      end.focusDistance = r3(p.focusDistance - d)
      end.focalLength = r3((p.focalLength * (p.focusDistance - d)) / p.focusDistance)
      break
    }
  }
  return end
}

/** Two keys: now → end of shot, eased in and out. */
export function moveKeys(move: MoveId, start: CameraPose, duration: number, amount: number, newId: () => string, easing: Ease = 'easeInOut'): CameraKey[] {
  const end = endPose(move, start, amount)
  return [
    { id: newId(), t: 0, ...start, ease: easing },
    { id: newId(), t: duration, ...end, ease: easing }
  ]
}
