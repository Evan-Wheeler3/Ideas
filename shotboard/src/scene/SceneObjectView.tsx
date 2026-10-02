import { memo, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box3, MathUtils, Vector3, type Group, type Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import type { JointName, SceneObject } from '../shared/types'
import { assetUrl } from '../store/assets'
import { Mannequin } from './Mannequin'
import { PropModel } from './Props'
import { useLabelLayer } from './labelLayer'
import { wasDrag } from './clickGuard'

export { SELECT_COLOR } from './colors'

const DEG = MathUtils.DEG2RAD

/** Name given to each object's root group, so the gizmo and framing can find it. */
export const objectNodeName = (id: string): string => `obj:${id}`

export function Shape({ kind, color }: { kind: SceneObject['kind']; color: string }) {
  const isPlane = kind === 'plane'
  return (
    <mesh castShadow={!isPlane} receiveShadow position={isPlane ? [0, -0.01, 0] : undefined}>
      {kind === 'sphere' && <sphereGeometry args={[0.5, 48, 32]} />}
      {kind === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 48]} />}
      {kind === 'cone' && <coneGeometry args={[0.5, 1, 48]} />}
      {/* Planes are thin boxes whose top face sits at the origin. */}
      {kind === 'plane' && <boxGeometry args={[1, 0.02, 1]} />}
      {kind === 'box' && <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />
    </mesh>
  )
}

export function ImportedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const copy = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return c
  }, [scene])
  return <primitive object={copy} />
}

export function MissingModel() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#e5484d" wireframe />
    </mesh>
  )
}

export const SHAPES = new Set(['box', 'sphere', 'cylinder', 'cone', 'plane'])

interface Props {
  obj: SceneObject
  selected: boolean
  hovered: boolean
  showLabel: boolean
  selectedJoint: JointName | null
  onSelect(id: string, additive: boolean): void
  onHover(id: string | null): void
  onPickJoint(objectId: string, joint: JointName): void
}

export const SceneObjectView = memo(function SceneObjectView({
  obj,
  selected,
  hovered,
  showLabel,
  selectedJoint,
  onSelect,
  onHover,
  onPickJoint
}: Props) {
  const group = useRef<Group>(null)
  const labelLayer = useLabelLayer()
  const [labelAt, setLabelAt] = useState<[number, number, number] | null>(null)

  // Place the name label just above the object's bounds. Re-measure shortly after, for models that load late.
  useLayoutEffect(() => {
    const measure = () => {
      if (!group.current) return
      const box = new Box3().setFromObject(group.current)
      if (box.isEmpty()) return
      const c = box.getCenter(new Vector3())
      setLabelAt([c.x, box.max.y + 0.12, c.z])
    }
    measure()
    const t = setTimeout(measure, 400)
    return () => clearTimeout(t)
  }, [obj])

  const url = obj.assetId ? assetUrl(obj.assetId) : undefined

  return (
    <>
      <group
        ref={group}
        name={objectNodeName(obj.id)}
        position={obj.position}
        rotation={[obj.rotation[0] * DEG, obj.rotation[1] * DEG, obj.rotation[2] * DEG]}
        scale={obj.scale}
        visible={obj.visible}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (wasDrag(e.nativeEvent)) return
          onSelect(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onHover(obj.id)
        }}
        onPointerOut={() => onHover(null)}
      >
        <Select enabled={selected}>
          {obj.kind === 'prop' && obj.propId && <PropModel propId={obj.propId} color={obj.color} />}
          {obj.kind === 'mannequin' && obj.pose && (
            <Mannequin
              objectId={obj.id}
              pose={obj.pose}
              color={obj.color}
              showHandles={selected}
              selectedJoint={selectedJoint}
              onPickJoint={(j) => onPickJoint(obj.id, j)}
            />
          )}
          {obj.kind === 'model' &&
            (url ? (
              <Suspense fallback={null}>
                <ImportedModel url={url} />
              </Suspense>
            ) : (
              <MissingModel />
            ))}
          {SHAPES.has(obj.kind) && <Shape kind={obj.kind} color={obj.color} />}
        </Select>
      </group>
      {/* Labels stay mounted and are hidden with CSS: unmounting drei's Html mid-render warns in React 19. */}
      {labelAt && (
        <Html portal={labelLayer} position={labelAt} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className={`obj-label${selected ? ' selected' : ''}${hovered ? ' hovered' : ''}`}
            style={obj.visible && ((showLabel && obj.kind !== 'plane') || hovered || selected) ? undefined : { display: 'none' }}
          >
            <span className="obj-label-dot" style={{ background: obj.color }} />
            {obj.name}
          </div>
        </Html>
      )}
    </>
  )
})
