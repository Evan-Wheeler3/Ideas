import { Euler, Matrix4, Quaternion, Vector3, MathUtils } from 'three'
import type { Vec3 } from '../shared/types'

const UP = new Vector3(0, 1, 0)
const round = (n: number) => Math.round(n * 100) / 100

/** Camera rotation (degrees, YXZ) that looks from `from` toward `to`, with no roll. */
export function lookAtRotation(from: Vec3, to: Vec3): Vec3 {
  const m = new Matrix4().lookAt(new Vector3(...from), new Vector3(...to), UP)
  const e = new Euler().setFromQuaternion(new Quaternion().setFromRotationMatrix(m), 'YXZ')
  return [round(MathUtils.radToDeg(e.x)), round(MathUtils.radToDeg(e.y)), round(MathUtils.radToDeg(e.z))]
}

/** Unit vector the camera looks along, for a rotation in degrees (YXZ). */
export function forwardVector(rotation: Vec3): Vector3 {
  const e = new Euler(
    MathUtils.degToRad(rotation[0]),
    MathUtils.degToRad(rotation[1]),
    MathUtils.degToRad(rotation[2]),
    'YXZ'
  )
  return new Vector3(0, 0, -1).applyEuler(e)
}

export const cameraEuler = (rotation: Vec3): Euler =>
  new Euler(MathUtils.degToRad(rotation[0]), MathUtils.degToRad(rotation[1]), MathUtils.degToRad(rotation[2]), 'YXZ')
