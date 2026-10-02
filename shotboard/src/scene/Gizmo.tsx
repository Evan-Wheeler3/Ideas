import { useEffect, useRef, useState } from 'react'
import { MathUtils, type Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import type { SceneObject, Vec3 } from '../shared/types'
import { updateObject } from '../commands/objects'
import { useStore } from '../store/store'
import { objectNodeName } from './SceneObjectView'

const round = (n: number, digits = 4): number => Math.round(n * 10 ** digits) / 10 ** digits
const toVec = (x: number, y: number, z: number): Vec3 => [round(x), round(y), round(z)]

/** Time of the last gizmo release. The viewport ignores the click that ends a drag. */
export const gizmoState = { lastDragEnd: 0 }

export function Gizmo({ shotId, obj }: { shotId: string; obj: SceneObject }) {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)
  const mode = useStore((s) => s.gizmo)
  const space = useStore((s) => s.gizmoSpace)
  const snap = useStore((s) => s.snap)
  const run = useStore((s) => s.run)
  const startRef = useRef<Pick<SceneObject, 'position' | 'rotation' | 'scale'> | null>(null)

  // The object's group mounts in the same commit as this component, so look it up after commit.
  useEffect(() => {
    setTarget(scene.getObjectByName(objectNodeName(obj.id)) ?? null)
  }, [scene, obj.id])

  if (!target) return null

  return (
    <TransformControls
      object={target}
      mode={mode}
      space={space}
      size={0.9}
      translationSnap={snap.enabled ? snap.translate : null}
      rotationSnap={snap.enabled ? snap.rotateDeg * MathUtils.DEG2RAD : null}
      scaleSnap={snap.enabled ? snap.scale : null}
      onMouseDown={() => {
        startRef.current = { position: obj.position, rotation: obj.rotation, scale: obj.scale }
      }}
      onMouseUp={() => {
        const before = startRef.current
        startRef.current = null
        gizmoState.lastDragEnd = performance.now()
        if (!before) return
        const after = {
          position: toVec(target.position.x, target.position.y, target.position.z),
          rotation: toVec(
            MathUtils.radToDeg(target.rotation.x),
            MathUtils.radToDeg(target.rotation.y),
            MathUtils.radToDeg(target.rotation.z)
          ),
          scale: toVec(target.scale.x, target.scale.y, target.scale.z)
        }
        if (JSON.stringify(after) === JSON.stringify(before)) return
        const verb = mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'
        run(updateObject(shotId, obj.id, before, after, `${verb} ${obj.name}`, false))
      }}
    />
  )
}
