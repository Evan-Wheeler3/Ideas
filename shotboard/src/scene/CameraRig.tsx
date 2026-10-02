// The shot camera as seen in the editor view: a camera body, its view cone out to the
// focus distance, and (when depth of field is on) faint planes at the near/far focus limits.
import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { AspectRatio, Camera } from '../shared/types'
import { depthOfField, fieldOfView, formatDistance } from '../camera/lens'
import { cameraEuler } from '../camera/orient'
import { CAMERA_COLOR } from './colors'
import { objectNodeName } from './SceneObjectView'
import { CAMERA_ID } from '../store/store'
import { useLabelLayer } from './labelLayer'
import { wasDrag } from './clickGuard'

type P = [number, number, number]

function frameAt(d: number, halfW: number, halfH: number): P[] {
  const w = d * halfW
  const h = d * halfH
  return [[-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d], [-w, -h, -d]]
}

interface Props {
  /** Hidden while looking through the camera (kept mounted so its label doesn't remount). */
  hidden: boolean
  camera: Camera
  aspect: AspectRatio
  selected: boolean
  hovered: boolean
  onSelect(): void
  onHover(on: boolean): void
}

export function CameraRig({ hidden, camera, aspect, selected, hovered, onSelect, onHover }: Props) {
  const labelLayer = useLabelLayer()
  const fov = fieldOfView(camera.focalLength, camera.sensor, aspect)
  const halfW = Math.tan((fov.h * Math.PI) / 360)
  const halfH = Math.tan((fov.v * Math.PI) / 360)
  const d = Math.min(Math.max(camera.focusDistance, 0.3), 40)
  const dof = depthOfField(camera)
  const color = selected ? '#ffffff' : CAMERA_COLOR

  const lines = useMemo(() => {
    const frame = frameAt(d, halfW, halfH)
    const rays = frame.slice(0, 4).map((corner) => [[0, 0, 0] as P, corner])
    return { frame, rays }
  }, [d, halfW, halfH])

  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (!wasDrag(e.nativeEvent)) onSelect()
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(true)
    },
    onPointerOut: () => onHover(false)
  }

  return (
    <group name={objectNodeName(CAMERA_ID)} position={camera.position} rotation={cameraEuler(camera.rotation)} visible={!hidden}>
      {/* Body */}
      <group {...handlers}>
        <mesh position={[0, 0, 0.12]} castShadow>
          <boxGeometry args={[0.16, 0.2, 0.3]} />
          <meshStandardMaterial color="#2a2e35" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.065, 0.12, 24]} />
          <meshStandardMaterial color="#15171a" roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.13, 0.12]}>
          <boxGeometry args={[0.04, 0.06, 0.22]} />
          <meshStandardMaterial color="#2a2e35" />
        </mesh>
        {/* Front marker so the camera's direction is clear from any angle. */}
        <mesh position={[0, 0, -0.145]}>
          <circleGeometry args={[0.04, 24]} />
          <meshBasicMaterial color={CAMERA_COLOR} />
        </mesh>
      </group>

      {/* View cone to the focus distance */}
      {lines.rays.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={1} transparent opacity={0.55} />
      ))}
      <Line points={lines.frame} color={color} lineWidth={selected || hovered ? 2 : 1.5} />
      <mesh position={[0, 0, -d]}>
        <planeGeometry args={[2 * d * halfW, 2 * d * halfH]} />
        <meshBasicMaterial color={CAMERA_COLOR} transparent opacity={0.06} side={DoubleSide} depthWrite={false} />
      </mesh>
      {/* Up marker on the frame, like a viewfinder's top edge. */}
      <Line
        points={[[-d * halfW * 0.15, d * halfH, -d], [0, d * halfH * 1.18, -d], [d * halfW * 0.15, d * halfH, -d]]}
        color={color}
        lineWidth={1.5}
      />

      {camera.dof &&
        [dof.near, dof.far].filter((x) => Number.isFinite(x) && x < 60).map((x, i) => (
          <Line key={i} points={frameAt(x, halfW, halfH)} color={CAMERA_COLOR} lineWidth={1} dashed dashSize={0.08} gapSize={0.06} transparent opacity={0.5} />
        ))}

      <Html portal={labelLayer} position={[0, 0.3, 0.1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`obj-label camera-label${selected ? ' selected' : ''}`} style={hidden ? { display: 'none' } : undefined}>
          <span className="obj-label-dot" style={{ background: CAMERA_COLOR }} />
          Camera · {Math.round(camera.focalLength)}mm · {formatDistance(camera.focusDistance)}
        </div>
      </Html>
    </group>
  )
}
