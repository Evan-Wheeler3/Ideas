// Renders frames of any shot at export resolution, through the shot's camera at given times
// (moves and handheld shake included), in a hidden canvas. Used for PDF pictures, stills and
// the animatic. Call `renderFrames(job)`; the host component below does the work.
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { PCFShadowMap, type PerspectiveCamera } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import type { AspectRatio, Shot } from '../shared/types'
import { cameraAt, keyedPose } from '../camera/animate'
import { fieldOfView } from '../camera/lens'
import { cameraEuler } from '../camera/orient'
import { ShotContent } from '../scene/ShotContent'

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled')
  }
}

export interface FrameJob {
  shots: Shot[]
  width: number
  height: number
  aspect: AspectRatio
  /** Times (seconds) to render for each shot. */
  times(shot: Shot): number[]
  format: 'image/jpeg' | 'image/png'
  quality?: number
  /** Include handheld shake (yes for the animatic; stills use the clean keyed pose). */
  shake: boolean
  onFrame(shotIndex: number, frameIndex: number, blob: Blob): Promise<void>
  cancelled(): boolean
}

interface Running {
  job: FrameJob
  resolve(): void
  reject(e: unknown): void
}

const useFrameJob = create<{ running: Running | null }>(() => ({ running: null }))

export function renderFrames(job: FrameJob): Promise<void> {
  if (useFrameJob.getState().running) return Promise.reject(new Error('Another export is already running'))
  return new Promise((resolve, reject) => {
    const finish = () => useFrameJob.setState({ running: null })
    useFrameJob.setState({
      running: {
        job,
        resolve: () => (finish(), resolve()),
        reject: (e) => (finish(), reject(e))
      }
    })
  })
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Renders one shot's frames, then calls onDone. Mounted inside the shot's Suspense boundary. */
function ShotFrames({ index, running, onDone }: { index: number; running: Running; onDone(): void }) {
  const { job } = running
  const shot = job.shots[index]
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const advance = useThree((s) => s.advance)
  const size = useThree((s) => s.size)

  useEffect(() => {
    if (size.width !== job.width || size.height !== job.height) return // wait for the canvas to size itself
    let alive = true
    ;(async () => {
      try {
        // Let lights, shadows and the environment settle for a couple of frames.
        for (let i = 0; i < 3; i++) {
          advance(performance.now())
          await nextFrame()
        }
        const times = job.times(shot)
        for (let i = 0; i < times.length; i++) {
          if (!alive) return
          if (job.cancelled()) throw new ExportCancelled()
          const cam = job.shake ? cameraAt(shot, times[i]) : { ...shot.camera, ...keyedPose(shot, times[i]) }
          camera.position.set(...cam.position)
          camera.rotation.copy(cameraEuler(cam.rotation))
          camera.fov = fieldOfView(cam.focalLength, cam.sensor, job.aspect).v
          camera.aspect = job.width / job.height
          camera.near = 0.05
          camera.far = 500
          camera.updateProjectionMatrix()
          gl.render(scene, camera)
          const blob = await new Promise<Blob | null>((r) => gl.domElement.toBlob(r, job.format, job.quality))
          if (!blob) throw new Error('Could not read a rendered frame')
          await job.onFrame(index, i, blob)
        }
        if (alive) onDone()
      } catch (e) {
        if (alive) running.reject(e)
      }
    })()
    return () => {
      alive = false
    }
  }, [size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/** Mount once (in App). Shows nothing; holds a canvas only while a job runs. */
export function FrameRendererHost() {
  const running = useFrameJob((s) => s.running)
  const [index, setIndex] = useState(0)

  useEffect(() => setIndex(0), [running])

  if (!running) return null
  const { job } = running
  return (
    <div className="frame-renderer" style={{ width: job.width, height: job.height }} aria-hidden>
      <Canvas
        frameloop="never"
        dpr={1}
        shadows={{ type: PCFShadowMap }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 30 }}
      >
        {index < job.shots.length && (
          <ShotContent key={index} shot={job.shots[index]}>
            <ShotFrames
              index={index}
              running={running}
              onDone={() => (index + 1 < job.shots.length ? setIndex(index + 1) : running.resolve())}
            />
          </ShotContent>
        )}
      </Canvas>
    </div>
  )
}
