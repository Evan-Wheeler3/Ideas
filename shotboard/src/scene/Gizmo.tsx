import { useEffect, useRef, useState } from 'react'
import { MathUtils, Matrix4, type Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import type { Vec3 } from '../shared/types'
import { useStore, type GizmoMode } from '../store/store'

const round = (n: number, digits = 4): number => Math.round(n * 10 ** digits) / 10 ** digits + 0 // + 0: no -0

/** Read a node's transform back as stored values (degrees for rotation). */
export function readTransform(o: Object3D): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  return {
    position: [round(o.position.x), round(o.position.y), round(o.position.z)],
    rotation: [
      round(MathUtils.radToDeg(o.rotation.x), 2),
      round(MathUtils.radToDeg(o.rotation.y), 2),
      round(MathUtils.radToDeg(o.rotation.z), 2)
    ],
    scale: [round(o.scale.x), round(o.scale.y), round(o.scale.z)]
  }
}

/** Time of the last gizmo release. The viewport ignores the click that ends a drag. */
export const gizmoState = { lastDragEnd: 0 }

interface Props {
  /** Name of the scene node to attach to. */
  nodeName: string
  mode: GizmoMode
  space: 'world' | 'local'
  /** Called once when a drag ends and the node actually changed. */
  onCommit(node: Object3D, mode: GizmoMode): void
}

export function Gizmo({ nodeName, mode, space, onCommit }: Props) {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)
  const snap = useStore((s) => s.snap)
  const start = useRef<Matrix4 | null>(null)

  // The node mounts in the same commit as this component, so look it up after commit.
  useEffect(() => {
    setTarget(scene.getObjectByName(nodeName) ?? null)
  }, [scene, nodeName])

  if (!target) return null

  return (
    <TransformControls
      object={target}
      mode={mode}
      space={space}
      size={mode === 'rotate' && space === 'local' ? 0.7 : 0.9}
      translationSnap={snap.enabled ? snap.translate : null}
      rotationSnap={snap.enabled ? snap.rotateDeg * MathUtils.DEG2RAD : null}
      scaleSnap={snap.enabled ? snap.scale : null}
      onMouseDown={() => {
        start.current = target.matrix.clone()
      }}
      onMouseUp={() => {
        gizmoState.lastDragEnd = performance.now()
        const before = start.current
        start.current = null
        target.updateMatrix()
        if (before && !before.equals(target.matrix)) onCommit(target, mode)
      }}
    />
  )
}
