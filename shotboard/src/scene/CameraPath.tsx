// The shot camera's move drawn in the editor: its path, and a dot at each keyframe.
import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import type { Shot } from '../shared/types'
import { cameraPath } from '../camera/animate'
import { useStore } from '../store/store'
import { CAMERA_COLOR, SELECT_COLOR } from './colors'

export function CameraPath({ shot }: { shot: Shot }) {
  const selectedKeyId = useStore((s) => s.selectedKeyId)
  const points = useMemo(() => cameraPath(shot), [shot])
  if (shot.keys.length < 2) return null
  return (
    <group>
      <Line points={points} color={CAMERA_COLOR} lineWidth={2} dashed dashSize={0.12} gapSize={0.06} />
      {shot.keys.map((k) => (
        <mesh key={k.id} position={k.position}>
          <sphereGeometry args={[k.id === selectedKeyId ? 0.07 : 0.05, 16, 12]} />
          <meshBasicMaterial color={k.id === selectedKeyId ? SELECT_COLOR : CAMERA_COLOR} />
        </mesh>
      ))}
    </group>
  )
}
