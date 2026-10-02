import { memo } from 'react'
import { MathUtils } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { Select } from '@react-three/postprocessing'
import type { SceneObject } from '../shared/types'

const DEG = MathUtils.DEG2RAD
export const SELECT_COLOR = '#f5a524'

/** Name given to each object's root group, so the gizmo and framing can find it. */
export const objectNodeName = (id: string): string => `obj:${id}`

function Geometry({ kind }: { kind: SceneObject['kind'] }) {
  switch (kind) {
    case 'sphere':
      return <sphereGeometry args={[0.5, 48, 32]} />
    case 'cylinder':
      return <cylinderGeometry args={[0.5, 0.5, 1, 48]} />
    case 'cone':
      return <coneGeometry args={[0.5, 1, 48]} />
    case 'plane':
      return <boxGeometry args={[1, 0.02, 1]} />
    default:
      return <boxGeometry args={[1, 1, 1]} />
  }
}

interface Props {
  obj: SceneObject
  selected: boolean
  onSelect(id: string, additive: boolean): void
}

export const SceneObjectView = memo(function SceneObjectView({ obj, selected, onSelect }: Props) {
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)
  }
  const isFloor = obj.kind === 'plane'

  return (
    <group
      name={objectNodeName(obj.id)}
      position={obj.position}
      rotation={[obj.rotation[0] * DEG, obj.rotation[1] * DEG, obj.rotation[2] * DEG]}
      scale={obj.scale}
      visible={obj.visible}
    >
      <Select enabled={selected}>
        <mesh
          castShadow={!isFloor}
          receiveShadow
          onClick={handleClick}
          // Planes sit on y=0; nudge them down so their top face is at the object's origin.
          position={isFloor ? [0, -0.01, 0] : undefined}
        >
          <Geometry kind={obj.kind} />
          <meshStandardMaterial color={obj.color} roughness={0.65} metalness={0.05} />
        </mesh>
      </Select>
    </group>
  )
})
