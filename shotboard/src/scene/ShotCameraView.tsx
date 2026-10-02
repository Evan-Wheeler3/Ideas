// Looking through the shot camera. Dragging in the view moves the shot camera itself:
// orbit around the focus point, pan, and dolly in/out (which also pulls focus).
import { useMemo, useState } from 'react'
import { Vector3, type PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { AspectRatio, Camera } from '../shared/types'
import { aspectValue, canvasFov, fieldOfView } from '../camera/lens'
import { gateRect } from '../camera/gate'
import { cameraEuler, forwardVector } from '../camera/orient'
import { readTransform } from './Gizmo'

interface Props {
  camera: Camera
  aspect: AspectRatio
  onCommit(patch: Partial<Camera>): void
}

export function ShotCameraView({ camera, aspect, onCommit }: Props) {
  // Keep the camera object in state so the controls are built for *this* camera, not the editor one.
  const [cam, setCam] = useState<PerspectiveCameraImpl | null>(null)
  const size = useThree((s) => s.size)

  const gate = gateRect(size.width, size.height, aspectValue(aspect))
  const fov = canvasFov(fieldOfView(camera.focalLength, camera.sensor, aspect).v, size.height, gate.height)
  const rotation = useMemo(() => cameraEuler(camera.rotation), [camera.rotation])
  // Orbit around the point the camera is focused on.
  const target = useMemo(
    () =>
      new Vector3(...camera.position)
        .addScaledVector(forwardVector(camera.rotation), Math.max(camera.focusDistance, 0.3))
        .toArray(),
    [camera.position, camera.rotation, camera.focusDistance]
  )

  return (
    <>
      <PerspectiveCamera
        ref={setCam}
        makeDefault
        fov={fov}
        near={0.05}
        far={500}
        position={camera.position}
        rotation={rotation}
      />
      {cam && (
        <OrbitControls
          camera={cam}
          makeDefault
          enableDamping={false}
          rotateSpeed={0.5}
          zoomSpeed={0.6}
          target={target}
          onEnd={(e) => {
            const ctl = e?.target as OrbitControlsImpl | undefined
            if (!ctl) return
            const t = readTransform(cam)
            const focus = Math.round(cam.position.distanceTo(ctl.target) * 100) / 100
            const changed =
              t.position.some((v, i) => Math.abs(v - camera.position[i]) > 1e-3) ||
              t.rotation.some((v, i) => Math.abs(v - camera.rotation[i]) > 1e-2) ||
              Math.abs(focus - camera.focusDistance) > 1e-2
            if (changed) onCommit({ position: t.position, rotation: t.rotation, focusDistance: focus })
          }}
        />
      )}
    </>
  )
}

/** Where the editor camera is and what it orbits around; kept across view switches. */
export const editorView = { target: new Vector3(0.4, 0.8, 1.6), position: new Vector3(7.2, 4.8, 9.6) }
