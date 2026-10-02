import { useCallback, useEffect } from 'react'
import { Box3, PCFShadowMap, Vector3, type PerspectiveCamera } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, GizmoHelper, GizmoViewport, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { EffectComposer, Outline, Selection, SMAA } from '@react-three/postprocessing'
import { getActiveShot, useActiveShot, useStore } from '../store/store'
import { SELECT_COLOR, SceneObjectView, objectNodeName } from './SceneObjectView'
import { Gizmo, gizmoState } from './Gizmo'

const SELECT_COLOR_HEX = Number.parseInt(SELECT_COLOR.slice(1), 16)
const SELECT_HIDDEN_HEX = 0x7a5312

/** Neutral studio lighting for the editor. Real lighting setups arrive in milestone 5. */
function StudioLighting() {
  return (
    <>
      <hemisphereLight args={['#d8e0ff', '#2a2622', 0.45]} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      {/* Procedural environment for soft reflections; no network needed. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 5, -5]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
    </>
  )
}

/** Moves the editor camera to fit the selection (or everything) when F is pressed. */
function FrameSelection() {
  const request = useStore((s) => s.frameRequest)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!request || !controls) return
    const { selection } = useStore.getState()
    const ids = selection.length ? selection : getActiveShot().scene.objects.map((o) => o.id)
    const box = new Box3()
    for (const id of ids) {
      const node = scene.getObjectByName(objectNodeName(id))
      if (node) box.expandByObject(node)
    }
    if (box.isEmpty()) return
    const center = box.getCenter(new Vector3())
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.5)
    const dist = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.1
    const dir = camera.position.clone().sub(controls.target).normalize()
    controls.target.copy(center)
    camera.position.copy(center).addScaledVector(dir, dist)
    controls.update()
  }, [request, camera, controls, scene])

  return null
}

export function Viewport() {
  const shot = useActiveShot()
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const toggleSelect = useStore((s) => s.toggleSelect)

  const onSelect = useCallback(
    (id: string, additive: boolean) => (additive ? toggleSelect(id) : select([id])),
    [select, toggleSelect]
  )
  const primary = shot.scene.objects.find((o) => o.id === selection[selection.length - 1])

  return (
    <div className="viewport">
      <Canvas
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [6, 4.5, 7.5], fov: 40, near: 0.05, far: 500 }}
        onPointerMissed={(e) => {
          // A gizmo drag ends with a click that hits nothing; don't treat it as "deselect".
          if (e.type === 'click' && performance.now() - gizmoState.lastDragEnd > 150) select([])
        }}
      >
        <color attach="background" args={[shot.scene.environment.color]} />
        <fog attach="fog" args={[shot.scene.environment.color, 25, 70]} />
        <StudioLighting />
        <Grid
          position={[0, 0.002, 0]}
          infiniteGrid
          cellSize={0.5}
          sectionSize={2.5}
          cellThickness={0.6}
          sectionThickness={1}
          cellColor="#4a4e57"
          sectionColor="#5d636e"
          fadeDistance={45}
          fadeStrength={1.5}
        />
        <Selection>
          {shot.scene.objects.map((o) => (
            <SceneObjectView key={o.id} obj={o} selected={selection.includes(o.id)} onSelect={onSelect} />
          ))}
          <EffectComposer autoClear={false} multisampling={4}>
            <Outline visibleEdgeColor={SELECT_COLOR_HEX} hiddenEdgeColor={SELECT_HIDDEN_HEX} edgeStrength={4} />
            <SMAA />
          </EffectComposer>
        </Selection>
        {primary && <Gizmo key={primary.id} shotId={shot.id} obj={primary} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.495} />
        <FrameSelection />
        {/* Priority 2: draw after the effect composer, which renders the scene at priority 1. */}
        <GizmoHelper alignment="bottom-right" margin={[64, 64]} renderPriority={2}>
          <GizmoViewport axisColors={['#e5484d', '#46a758', '#3e63dd']} labelColor="#111" />
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
