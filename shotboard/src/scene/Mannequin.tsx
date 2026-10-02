// A simple poseable figure, 1.75 m tall, facing +Z. Built from rounded shapes so it reads
// clearly at storyboard level: shirt color = the object's color, darker trousers, neutral skin.
import type { ReactNode } from 'react'
import { Color, MathUtils } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import type { JointName, Pose, Vec3 } from '../shared/types'
import { SELECT_COLOR } from './colors'
import { wasDrag } from './clickGuard'

const SKIN = '#d6d0c7'
const DEG = MathUtils.DEG2RAD

export const jointNodeName = (objectId: string, joint: JointName): string => `joint:${objectId}:${joint}`

const rot = (pose: Pose, j: JointName): [number, number, number] => {
  const r: Vec3 = pose.joints[j] ?? [0, 0, 0]
  return [r[0] * DEG, r[1] * DEG, r[2] * DEG]
}

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.75} metalness={0} />
}

/** A limb segment hanging down from its joint. */
function Limb({ length, radius, color }: { length: number; radius: number; color: string }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow receiveShadow>
      <capsuleGeometry args={[radius, Math.max(length - radius * 2, 0.01), 6, 16]} />
      <Mat color={color} />
    </mesh>
  )
}

interface JointProps {
  objectId: string
  name: JointName
  pose: Pose
  position: [number, number, number]
  showHandles: boolean
  selectedJoint: JointName | null
  onPickJoint(j: JointName): void
  children: ReactNode
}

function Joint({ objectId, name, pose, position, showHandles, selectedJoint, onPickJoint, children }: JointProps) {
  const active = selectedJoint === name
  return (
    <group name={jointNodeName(objectId, name)} position={position} rotation={rot(pose, name)}>
      {showHandles && (
        <mesh
          renderOrder={10}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            if (!wasDrag(e.nativeEvent)) onPickJoint(name)
          }}
        >
          <sphereGeometry args={[active ? 0.042 : 0.034, 16, 12]} />
          <meshBasicMaterial color={active ? SELECT_COLOR : '#ffffff'} depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
      {children}
    </group>
  )
}

interface Props {
  objectId: string
  pose: Pose
  color: string
  showHandles: boolean
  selectedJoint: JointName | null
  onPickJoint(j: JointName): void
}

export function Mannequin({ objectId, pose, color, showHandles, selectedJoint, onPickJoint }: Props) {
  const shirt = color
  const pants = `#${new Color(color).offsetHSL(0, -0.25, -0.22).getHexString()}`
  const j = { objectId, pose, showHandles, selectedJoint, onPickJoint }

  const arm = (side: 1 | -1) => (
    <Joint {...j} name={side === 1 ? 'armL' : 'armR'} position={[0.215 * side, 0.43, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.062, 16, 12]} />
        <Mat color={shirt} />
      </mesh>
      <Limb length={0.29} radius={0.052} color={shirt} />
      <Joint {...j} name={side === 1 ? 'forearmL' : 'forearmR'} position={[0, -0.29, 0]}>
        <Limb length={0.26} radius={0.042} color={SKIN} />
        <mesh position={[0, -0.3, 0.005]} castShadow>
          <sphereGeometry args={[0.048, 16, 12]} />
          <Mat color={SKIN} />
        </mesh>
      </Joint>
    </Joint>
  )

  const leg = (side: 1 | -1) => (
    <Joint {...j} name={side === 1 ? 'legL' : 'legR'} position={[0.1 * side, -0.04, 0]}>
      <Limb length={0.43} radius={0.072} color={pants} />
      <Joint {...j} name={side === 1 ? 'shinL' : 'shinR'} position={[0, -0.43, 0]}>
        <Limb length={0.42} radius={0.058} color={pants} />
        {/* Foot points forward, so the figure's facing is obvious from above. */}
        <RoundedBox args={[0.1, 0.07, 0.25]} radius={0.03} position={[0, -0.425, 0.06]} castShadow>
          <Mat color="#33302c" />
        </RoundedBox>
      </Joint>
    </Joint>
  )

  return (
    <group position={[0, 0.93 + pose.hipsY, 0]}>
      <RoundedBox args={[0.32, 0.16, 0.2]} radius={0.06} castShadow receiveShadow>
        <Mat color={pants} />
      </RoundedBox>
      {leg(1)}
      {leg(-1)}
      <Joint {...j} name="torso" position={[0, 0.06, 0]}>
        <RoundedBox args={[0.38, 0.46, 0.22]} radius={0.09} position={[0, 0.25, 0]} castShadow receiveShadow>
          <Mat color={shirt} />
        </RoundedBox>
        {arm(1)}
        {arm(-1)}
        <Joint {...j} name="head" position={[0, 0.5, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 0.1, 16]} />
            <Mat color={SKIN} />
          </mesh>
          <mesh position={[0, 0.16, 0]} scale={[0.9, 1.05, 1]} castShadow>
            <sphereGeometry args={[0.105, 32, 20]} />
            <Mat color={SKIN} />
          </mesh>
          {/* Eye band: shows which way the figure is looking. */}
          <mesh position={[0, 0.175, 0.078]}>
            <boxGeometry args={[0.13, 0.03, 0.05]} />
            <meshStandardMaterial color="#22252a" roughness={0.4} />
          </mesh>
        </Joint>
      </Joint>
    </group>
  )
}
