// Renders shot thumbnails in a small hidden canvas, through each shot's own camera.
// It works through shots whose picture is missing or out of date (active shot first), one at a
// time, once edits have paused for a moment. Results go to the thumbs store as JPEG data URLs.
import { Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { PCFShadowMap, type PerspectiveCamera } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import type { AspectRatio, Shot } from '../shared/types'
import { aspectValue, fieldOfView } from '../camera/lens'
import { cameraEuler } from '../camera/orient'
import { keyedPose } from '../camera/animate'
import { useStore } from '../store/store'
import { shotHash, useThumbs } from '../store/thumbs'
import { assetUrl } from '../store/assets'
import { StudioLighting } from './Lighting'
import { Mannequin } from './Mannequin'
import { PropModel } from './Props'
import { ImportedModel, MissingModel, SHAPES, Shape } from './SceneObjectView'

export const THUMB_WIDTH = 480
const SETTLE_MS = 600
const DEG = Math.PI / 180
const noop = () => {}

function ShotCamera({ shot, aspect }: { shot: Shot; aspect: AspectRatio }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  useLayoutEffect(() => {
    // The thumbnail is the shot's first frame (no shake).
    const pose = keyedPose(shot, 0)
    camera.position.set(...pose.position)
    camera.rotation.copy(cameraEuler(pose.rotation))
    camera.fov = fieldOfView(pose.focalLength, shot.camera.sensor, aspect).v
    camera.near = 0.05
    camera.far = 500
    camera.updateProjectionMatrix()
  }, [camera, shot, aspect])
  return null
}

/** Waits for a few rendered frames (shadows, environment), then grabs the canvas. */
function Capture({ onDone }: { onDone(url: string): void }) {
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    let frames = 0
    let raf = 0
    const tick = () => {
      invalidate()
      if (++frames < 4) raf = requestAnimationFrame(tick)
      else raf = requestAnimationFrame(() => onDone(gl.domElement.toDataURL('image/jpeg', 0.85)))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate, gl, onDone])
  return null
}

function ShotScene({ shot, aspect, onDone }: { shot: Shot; aspect: AspectRatio; onDone(url: string): void }) {
  return (
    <>
      <color attach="background" args={[shot.scene.environment.color]} />
      <fog attach="fog" args={[shot.scene.environment.color, 25, 70]} />
      <ShotCamera shot={shot} aspect={aspect} />
      <StudioLighting />
      <Suspense fallback={null}>
        {shot.scene.objects
          .filter((o) => o.visible)
          .map((o) => {
            const url = o.assetId ? assetUrl(o.assetId) : undefined
            return (
              <group key={o.id} position={o.position} rotation={[o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG]} scale={o.scale}>
                {o.kind === 'prop' && o.propId && <PropModel propId={o.propId} color={o.color} />}
                {o.kind === 'mannequin' && o.pose && (
                  <Mannequin objectId={o.id} pose={o.pose} color={o.color} showHandles={false} selectedJoint={null} onPickJoint={noop} />
                )}
                {o.kind === 'model' && (url ? <ImportedModel url={url} /> : <MissingModel />)}
                {SHAPES.has(o.kind) && <Shape kind={o.kind} color={o.color} />}
              </group>
            )
          })}
        <Capture onDone={onDone} />
      </Suspense>
    </>
  )
}

export function ThumbnailRenderer() {
  const project = useStore((s) => s.project)
  const activeShotId = useStore((s) => s.activeShotId)
  const thumbs = useThumbs((s) => s.byShot)
  const put = useThumbs((s) => s.put)
  const [job, setJob] = useState<{ shot: Shot; hash: string } | null>(null)
  const aspect = project.settings.aspect

  useEffect(() => {
    if (job) return
    const stale = project.shots.filter((s) => thumbs[s.id]?.hash !== shotHash(s, aspect))
    if (!stale.length) return
    const next = stale.find((s) => s.id === activeShotId) ?? stale[0]
    const t = setTimeout(() => setJob({ shot: next, hash: shotHash(next, aspect) }), SETTLE_MS)
    return () => clearTimeout(t)
  }, [project, thumbs, job, activeShotId, aspect])

  const height = Math.round(THUMB_WIDTH / aspectValue(aspect))

  return (
    <div className="thumb-renderer" style={{ width: THUMB_WIDTH, height }} aria-hidden>
      <Canvas
        frameloop="demand"
        dpr={1}
        shadows={{ type: PCFShadowMap }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 30 }}
      >
        {job && (
          <ShotScene
            key={`${job.shot.id}:${job.hash}`}
            shot={job.shot}
            aspect={aspect}
            onDone={(url) => {
              put(job.shot.id, { url, hash: job.hash })
              setJob(null)
            }}
          />
        )}
      </Canvas>
    </div>
  )
}
