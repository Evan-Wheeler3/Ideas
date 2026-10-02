// Built-in props made from simple shapes, at real-world sizes (metres).
// Each sits on the floor at its origin and faces +Z (its "front").
import type { ReactNode } from 'react'
import { Color } from 'three'
import type { PropId } from '../shared/types'

type V3 = [number, number, number]

function Part({
  size,
  at,
  color,
  rot,
  shape = 'box',
  emissive
}: {
  size: V3
  at: V3
  color: string
  rot?: V3
  shape?: 'box' | 'cylinder' | 'sphere' | 'cone'
  emissive?: string
}) {
  return (
    <mesh position={at} rotation={rot} castShadow receiveShadow>
      {shape === 'box' && <boxGeometry args={size} />}
      {shape === 'cylinder' && <cylinderGeometry args={[size[0] / 2, size[2] / 2, size[1], 32]} />}
      {shape === 'sphere' && <sphereGeometry args={[size[0] / 2, 32, 20]} />}
      {shape === 'cone' && <coneGeometry args={[size[0] / 2, size[1], 32]} />}
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.02}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? 1.2 : 0}
      />
    </mesh>
  )
}

const shade = (hex: string, amount: number) => `#${new Color(hex).offsetHSL(0, 0, amount).getHexString()}`

const DARK = '#2b2d31'
const METAL = '#9aa0a8'
const GLASS = '#1d2b3a'
const CREAM = '#e9e2d4'

function Chair({ c }: { c: string }) {
  const legs: V3[] = [[-0.19, 0.22, -0.19], [0.19, 0.22, -0.19], [-0.19, 0.22, 0.19], [0.19, 0.22, 0.19]]
  return (
    <>
      <Part size={[0.46, 0.05, 0.46]} at={[0, 0.46, 0]} color={c} />
      <Part size={[0.46, 0.48, 0.05]} at={[0, 0.72, -0.21]} color={c} />
      {legs.map((p, i) => (
        <Part key={i} size={[0.04, 0.44, 0.04]} at={p} color={shade(c, -0.1)} />
      ))}
    </>
  )
}

function Table({ c }: { c: string }) {
  const legs: V3[] = [[-0.62, 0.36, -0.33], [0.62, 0.36, -0.33], [-0.62, 0.36, 0.33], [0.62, 0.36, 0.33]]
  return (
    <>
      <Part size={[1.4, 0.05, 0.8]} at={[0, 0.735, 0]} color={c} />
      {legs.map((p, i) => (
        <Part key={i} size={[0.06, 0.71, 0.06]} at={p} color={shade(c, -0.1)} />
      ))}
    </>
  )
}

function Sofa({ c }: { c: string }) {
  return (
    <>
      <Part size={[2.0, 0.42, 0.9]} at={[0, 0.21, 0]} color={c} />
      <Part size={[1.6, 0.14, 0.62]} at={[0, 0.48, 0.1]} color={shade(c, 0.06)} />
      <Part size={[2.0, 0.5, 0.22]} at={[0, 0.66, -0.34]} color={c} />
      <Part size={[0.2, 0.26, 0.9]} at={[-0.9, 0.55, 0]} color={c} />
      <Part size={[0.2, 0.26, 0.9]} at={[0.9, 0.55, 0]} color={c} />
    </>
  )
}

function Bed({ c }: { c: string }) {
  return (
    <>
      <Part size={[1.6, 0.32, 2.1]} at={[0, 0.16, 0]} color={c} />
      <Part size={[1.52, 0.2, 2.0]} at={[0, 0.42, 0.02]} color={CREAM} />
      <Part size={[1.3, 0.12, 0.4]} at={[0, 0.58, -0.75]} color="#f4f1ea" />
      <Part size={[1.54, 0.06, 1.3]} at={[0, 0.55, 0.36]} color={shade(c, 0.25)} />
      <Part size={[1.7, 1.0, 0.08]} at={[0, 0.5, -1.06]} color={shade(c, -0.08)} />
    </>
  )
}

function Counter({ c }: { c: string }) {
  return (
    <>
      <Part size={[2.0, 0.9, 0.6]} at={[0, 0.45, 0]} color={c} />
      <Part size={[2.04, 0.05, 0.66]} at={[0, 0.925, 0.02]} color={shade(c, 0.18)} />
      <Part size={[2.0, 0.08, 0.5]} at={[0, 0.04, 0.03]} color={DARK} />
    </>
  )
}

function FloorLamp({ c }: { c: string }) {
  return (
    <>
      <Part shape="cylinder" size={[0.3, 0.03, 0.3]} at={[0, 0.015, 0]} color={c} />
      <Part shape="cylinder" size={[0.03, 1.5, 0.03]} at={[0, 0.77, 0]} color={c} />
      <Part shape="cylinder" size={[0.3, 0.3, 0.44]} at={[0, 1.6, 0]} color={CREAM} emissive="#ffcf87" />
    </>
  )
}

function Wall({ c }: { c: string }) {
  return (
    <>
      <Part size={[4, 2.7, 0.12]} at={[0, 1.35, 0]} color={c} />
      <Part size={[4, 0.1, 0.14]} at={[0, 0.05, 0.01]} color={shade(c, -0.15)} />
    </>
  )
}

function Door({ c }: { c: string }) {
  return (
    <>
      <Part size={[1.06, 0.06, 0.16]} at={[0, 2.13, 0]} color={shade(c, -0.12)} />
      <Part size={[0.06, 2.16, 0.16]} at={[-0.5, 1.08, 0]} color={shade(c, -0.12)} />
      <Part size={[0.06, 2.16, 0.16]} at={[0.5, 1.08, 0]} color={shade(c, -0.12)} />
      <Part size={[0.92, 2.08, 0.05]} at={[0, 1.05, 0]} color={c} />
      <Part shape="sphere" size={[0.07, 0.07, 0.07]} at={[0.36, 1.0, 0.05]} color={METAL} />
    </>
  )
}

function Window({ c }: { c: string }) {
  return (
    <>
      <Part size={[1.4, 0.9, 0.04]} at={[0, 1.45, 0]} color={GLASS} />
      <Part size={[1.5, 0.08, 0.14]} at={[0, 1.94, 0]} color={c} />
      <Part size={[1.6, 0.06, 0.22]} at={[0, 0.98, 0.04]} color={c} />
      <Part size={[0.08, 1.0, 0.14]} at={[-0.71, 1.45, 0]} color={c} />
      <Part size={[0.08, 1.0, 0.14]} at={[0.71, 1.45, 0]} color={c} />
      <Part size={[0.05, 0.9, 0.08]} at={[0, 1.45, 0]} color={c} />
    </>
  )
}

function Stairs({ c }: { c: string }) {
  const steps = 8
  return (
    <>
      {Array.from({ length: steps }, (_, i) => (
        <Part
          key={i}
          size={[1.1, 0.18 * (i + 1), 0.28]}
          at={[0, (0.18 * (i + 1)) / 2, 1.0 - i * 0.28]}
          color={i % 2 ? c : shade(c, 0.04)}
        />
      ))}
    </>
  )
}

function Car({ c }: { c: string }) {
  const wheels: V3[] = [[-0.82, 0.33, 1.35], [0.82, 0.33, 1.35], [-0.82, 0.33, -1.35], [0.82, 0.33, -1.35]]
  return (
    <>
      <Part size={[1.8, 0.62, 4.4]} at={[0, 0.62, 0]} color={c} />
      <Part size={[1.62, 0.52, 2.3]} at={[0, 1.18, -0.25]} color={c} />
      {/* Dark glass band so the cabin reads as windows. */}
      <Part size={[1.64, 0.36, 2.2]} at={[0, 1.18, -0.25]} color={GLASS} />
      <Part size={[1.5, 0.04, 2.0]} at={[0, 1.45, -0.25]} color={c} />
      <Part size={[0.32, 0.12, 0.04]} at={[-0.6, 0.72, 2.2]} color="#fff6d8" emissive="#fff1c4" />
      <Part size={[0.32, 0.12, 0.04]} at={[0.6, 0.72, 2.2]} color="#fff6d8" emissive="#fff1c4" />
      <Part size={[0.3, 0.1, 0.04]} at={[-0.62, 0.74, -2.2]} color="#b3201b" emissive="#8f1510" />
      <Part size={[0.3, 0.1, 0.04]} at={[0.62, 0.74, -2.2]} color="#b3201b" emissive="#8f1510" />
      {wheels.map((p, i) => (
        <Part key={i} shape="cylinder" size={[0.66, 0.24, 0.66]} at={p} rot={[0, 0, Math.PI / 2]} color={DARK} />
      ))}
    </>
  )
}

function Tree({ c }: { c: string }) {
  return (
    <>
      <Part shape="cylinder" size={[0.24, 2.2, 0.3]} at={[0, 1.1, 0]} color="#5a4130" />
      <Part shape="sphere" size={[2.2, 2.2, 2.2]} at={[0, 3.0, 0]} color={c} />
      <Part shape="sphere" size={[1.5, 1.5, 1.5]} at={[0.6, 2.5, 0.3]} color={shade(c, 0.05)} />
      <Part shape="sphere" size={[1.4, 1.4, 1.4]} at={[-0.5, 2.6, -0.4]} color={shade(c, -0.05)} />
    </>
  )
}

const PROPS: Record<PropId, (p: { c: string }) => ReactNode> = {
  chair: Chair,
  table: Table,
  sofa: Sofa,
  bed: Bed,
  counter: Counter,
  floorLamp: FloorLamp,
  wall: Wall,
  door: Door,
  window: Window,
  stairs: Stairs,
  car: Car,
  tree: Tree
}

export function PropModel({ propId, color }: { propId: PropId; color: string }) {
  const Model = PROPS[propId]
  return <Model c={color} />
}
