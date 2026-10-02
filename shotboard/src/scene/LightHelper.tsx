// What a light looks like in the editor: a bulb, a spot with its beam, a sun with its direction,
// or a glowing panel. Hidden when looking through the camera.
import { useMemo } from 'react'
import { BackSide, DoubleSide } from 'three'
import { Line } from '@react-three/drei'
import type { SceneObject } from '../shared/types'
import { lightColor } from './kelvin'

const BODY = '#26292f'

export function LightHelper({ obj }: { obj: SceneObject }) {
  const l = obj.light!
  const color = useMemo(() => `#${lightColor(l.kelvin, l.color).getHexString()}`, [l.kelvin, l.color])
  // Undo the group's scale for parts that shouldn't stretch (area lights use scale as their size).
  const inv: [number, number, number] = [1 / obj.scale[0], 1 / obj.scale[1], 1 / obj.scale[2]]

  switch (l.type) {
    case 'point':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.08, 20, 14]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.14, 20, 14]} />
            <meshBasicMaterial color={color} transparent opacity={0.18} side={BackSide} depthWrite={false} />
          </mesh>
        </group>
      )
    case 'spot': {
      const h = 0.9
      const r = Math.tan((((l.angle ?? 35) / 2) * Math.PI) / 180) * h
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.06]}>
            <cylinderGeometry args={[0.07, 0.09, 0.18, 20]} />
            <meshStandardMaterial color={BODY} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.031]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.065, 20]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {/* Beam: apex at the light, opening along -Z. */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -h / 2]}>
            <coneGeometry args={[r, h, 24, 1, true]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
          </mesh>
        </group>
      )
    }
    case 'directional':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.16, 24, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Line points={[[0, 0, 0], [0, 0, -1.4]]} color={color} lineWidth={2} />
          <mesh position={[0, 0, -1.45]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.07, 0.18, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      )
    case 'area':
      return (
        <group>
          {/* The panel is 1×1 and takes its size from the object's scale. Its lit face points along -Z. */}
          <mesh rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[1.04, 1.04, 0.03]} />
            <meshStandardMaterial color={BODY} />
          </mesh>
          <group scale={inv}>
            <Line points={[[0, 0, 0], [0, 0, -0.6]]} color={color} lineWidth={1.5} transparent opacity={0.7} />
          </group>
        </group>
      )
  }
}
