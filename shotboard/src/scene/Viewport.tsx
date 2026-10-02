import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, MathUtils, PCFShadowMap, Vector3, type Object3D, type PerspectiveCamera } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, GizmoHelper, GizmoViewport, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DepthOfField, EffectComposer, Outline, Selection, SMAA } from '@react-three/postprocessing'
import type { AspectRatio, Camera, JointName, Vec3 } from '../shared/types'
import { updateCamera } from '../commands/project'
import { updateObject } from '../commands/objects'
import { activeArea, aspectValue, blurDiameter, depthOfField } from '../camera/lens'
import { gateRect } from '../camera/gate'
import { lookAtRotation } from '../camera/orient'
import { CAMERA_ID, getActiveShot, useActiveShot, useStore, type GizmoMode } from '../store/store'
import { importModelFiles } from '../store/actions'
import { SELECT_COLOR, SceneObjectView, objectNodeName } from './SceneObjectView'
import { jointNodeName } from './Mannequin'
import { CameraRig } from './CameraRig'
import { Gizmo, gizmoState, readTransform } from './Gizmo'
import { ShotCameraView, editorView } from './ShotCameraView'
import { ViewportOverlay } from './ViewportOverlay'
import { LabelLayerContext } from './labelLayer'
import { notePointerDown, wasDrag } from './clickGuard'

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

/** Bounds of the given objects in world space. */
function boundsOf(scene: Object3D, ids: string[]): Box3 {
  const box = new Box3()
  for (const id of ids) {
    const node = scene.getObjectByName(objectNodeName(id))
    if (node) box.expandByObject(node)
  }
  return box
}

/**
 * F key. Editor view: move the editor camera to fit the selection.
 * Camera view: aim the shot camera at the selection and pull focus to it.
 */
function FrameSelection() {
  const request = useStore((s) => s.frameRequest)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!request || !controls) return
    const { selection, viewMode, run } = useStore.getState()
    const shot = getActiveShot()
    const objectIds = selection.filter((id) => id !== CAMERA_ID)
    const ids = objectIds.length ? objectIds : shot.scene.objects.filter((o) => o.kind !== 'plane').map((o) => o.id)
    const box = boundsOf(scene, ids)
    if (box.isEmpty()) return
    const center = box.getCenter(new Vector3())

    if (viewMode === 'camera') {
      const from = shot.camera.position
      const to: Vec3 = [center.x, center.y, center.z]
      const focus = Math.round(new Vector3(...from).distanceTo(center) * 100) / 100
      run(
        updateCamera(
          shot.id,
          { rotation: shot.camera.rotation, focusDistance: shot.camera.focusDistance },
          { rotation: lookAtRotation(from, to), focusDistance: focus },
          'Aim camera',
          false
        )
      )
      return
    }

    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.5)
    const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1
    const dir = camera.position.clone().sub(controls.target).normalize()
    controls.target.copy(center)
    camera.position.copy(center).addScaledVector(dir, dist)
    controls.update()
  }, [request, camera, controls, scene])

  return null
}

/** Depth of field that follows the real lens: focus distance, and blur strength from focal length and f-stop. */
function LensDepthOfField({ camera, gateHeightPx, aspect }: { camera: Camera; gateHeightPx: number; aspect: AspectRatio }) {
  const { near, far } = depthOfField(camera)
  const range = Math.min(Math.max((Number.isFinite(far) ? far : camera.focusDistance * 4) - near, 0.05), 60)
  // Background blur disc as a share of the picture height, converted to pixels.
  const bgBlurPx = (blurDiameter(camera, Infinity) / activeArea(camera.sensor, aspect).height) * gateHeightPx
  const bokehScale = MathUtils.clamp(bgBlurPx / 7, 0, 9)
  return <DepthOfField worldFocusDistance={camera.focusDistance} worldFocusRange={range} bokehScale={bokehScale} />
}

function SizeWatcher({ onSize }: { onSize(s: { width: number; height: number }): void }) {
  const size = useThree((s) => s.size)
  useEffect(() => onSize({ width: size.width, height: size.height }), [size.width, size.height, onSize])
  return null
}

export function Viewport() {
  const shot = useActiveShot()
  const aspect = useStore((s) => s.project.settings.aspect)
  const selection = useStore((s) => s.selection)
  const joint = useStore((s) => s.joint)
  const hoveredId = useStore((s) => s.hoveredId)
  const showLabels = useStore((s) => s.showLabels)
  const viewMode = useStore((s) => s.viewMode)
  const gizmoMode = useStore((s) => s.gizmo)
  const gizmoSpace = useStore((s) => s.gizmoSpace)
  const { select, toggleSelect, setHovered, selectJoint, run } = useStore.getState()
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [dropping, setDropping] = useState(false)
  const labelLayer = useRef<HTMLDivElement>(null)

  const onSelect = useCallback(
    (id: string, additive: boolean) => (additive ? toggleSelect(id) : select([id])),
    [select, toggleSelect]
  )
  const onPickJoint = useCallback((id: string, j: JointName) => selectJoint(id, j), [selectJoint])
  const onHover = useCallback(
    (id: string | null) => {
      setHovered(id)
      document.body.style.cursor = id ? 'pointer' : ''
    },
    [setHovered]
  )

  const inCamera = viewMode === 'camera'
  const primaryId = selection[selection.length - 1]
  const primary = shot.scene.objects.find((o) => o.id === primaryId)

  // What the gizmo is attached to: a mannequin joint, the shot camera, or an object.
  const gizmo = useMemo(() => {
    if (joint && primary && joint.objectId === primary.id) {
      return { nodeName: jointNodeName(primary.id, joint.joint), mode: 'rotate' as GizmoMode, space: 'local' as const }
    }
    if (primaryId === CAMERA_ID) {
      if (inCamera) return null
      const mode: GizmoMode = gizmoMode === 'scale' ? 'translate' : gizmoMode
      return { nodeName: objectNodeName(CAMERA_ID), mode, space: gizmoSpace }
    }
    if (primary) return { nodeName: objectNodeName(primary.id), mode: gizmoMode, space: gizmoSpace }
    return null
  }, [joint, primary, primaryId, inCamera, gizmoMode, gizmoSpace])

  const commitGizmo = useCallback(
    (node: Object3D, mode: GizmoMode) => {
      const s = getActiveShot()
      const t = readTransform(node)
      const verb = mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'
      const { joint: j, selection: sel } = useStore.getState()
      const pid = sel[sel.length - 1]
      if (pid === CAMERA_ID) {
        run(
          updateCamera(
            s.id,
            { position: s.camera.position, rotation: s.camera.rotation },
            { position: t.position, rotation: t.rotation },
            `${verb} camera`,
            false
          )
        )
        return
      }
      const obj = s.scene.objects.find((o) => o.id === pid)
      if (!obj) return
      if (j && j.objectId === obj.id && obj.pose) {
        const pose = { ...obj.pose, preset: 'custom' as const, joints: { ...obj.pose.joints, [j.joint]: t.rotation } }
        run(updateObject(s.id, obj.id, { pose: obj.pose }, { pose }, `Pose ${obj.name}`, false))
        return
      }
      run(
        updateObject(
          s.id,
          obj.id,
          { position: obj.position, rotation: obj.rotation, scale: obj.scale },
          { position: t.position, rotation: t.rotation, scale: t.scale },
          `${verb} ${obj.name}`,
          false
        )
      )
    },
    [run]
  )

  const gate = gateRect(size.width, size.height, aspectValue(aspect))

  return (
    <div
      className={`viewport${dropping ? ' dropping' : ''}`}
      onPointerDownCapture={notePointerDown}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDropping(true)
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        void importModelFiles([...e.dataTransfer.files])
      }}
    >
      <div ref={labelLayer} className="label-layer" />
      <LabelLayerContext.Provider value={labelLayer}>
      <Canvas
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: editorView.position.toArray(), fov: 40, near: 0.05, far: 500 }}
        onPointerMissed={(e) => {
          // A gizmo drag ends with a click that hits nothing; don't treat it as "deselect".
          if (e.type === 'click' && !wasDrag(e) && performance.now() - gizmoState.lastDragEnd > 150) select([])
        }}
      >
        <SizeWatcher onSize={setSize} />
        <color attach="background" args={[shot.scene.environment.color]} />
        <fog attach="fog" args={[shot.scene.environment.color, 25, 70]} />
        <StudioLighting />
        {!inCamera && (
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
        )}
        <Selection>
          {shot.scene.objects.map((o) => (
            <SceneObjectView
              key={o.id}
              obj={o}
              selected={selection.includes(o.id)}
              hovered={hoveredId === o.id}
              showLabel={showLabels && !inCamera}
              selectedJoint={joint?.objectId === o.id ? joint.joint : null}
              onSelect={onSelect}
              onHover={onHover}
              onPickJoint={onPickJoint}
            />
          ))}
          <EffectComposer autoClear={false} multisampling={4}>
            <Outline visibleEdgeColor={SELECT_COLOR_HEX} hiddenEdgeColor={SELECT_HIDDEN_HEX} edgeStrength={inCamera ? 2.5 : 4} />
            {inCamera && shot.camera.dof ? (
              <LensDepthOfField camera={shot.camera} gateHeightPx={gate.height} aspect={aspect} />
            ) : (
              <></>
            )}
            <SMAA />
          </EffectComposer>
        </Selection>

        <CameraRig
            hidden={inCamera}
            camera={shot.camera}
            aspect={aspect}
            selected={selection.includes(CAMERA_ID)}
            hovered={hoveredId === CAMERA_ID}
            onSelect={() => select([CAMERA_ID])}
            onHover={(on) => onHover(on ? CAMERA_ID : null)}
          />

        {gizmo && <Gizmo key={gizmo.nodeName} {...gizmo} onCommit={commitGizmo} />}

        {inCamera ? (
          <ShotCameraView
            camera={shot.camera}
            aspect={aspect}
            onCommit={(patch) => {
              const s = getActiveShot()
              const before = Object.fromEntries(
                Object.keys(patch).map((k) => [k, s.camera[k as keyof Camera]])
              ) as Partial<Camera>
              run(updateCamera(s.id, before, patch, 'Move camera', false))
            }}
          />
        ) : (
          <>
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.12}
              maxPolarAngle={Math.PI * 0.495}
              target={editorView.target.toArray()}
              onChange={(e) => {
                const c = e?.target as OrbitControlsImpl | undefined
                if (!c) return
                editorView.target.copy(c.target)
                editorView.position.copy(c.object.position)
              }}
            />
            {/* Priority 2: draw after the effect composer, which renders the scene at priority 1. */}
            <GizmoHelper alignment="bottom-right" margin={[64, 64]} renderPriority={2}>
              <GizmoViewport axisColors={['#e5484d', '#46a758', '#3e63dd']} labelColor="#111" />
            </GizmoHelper>
          </>
        )}
        <FrameSelection />
      </Canvas>
      </LabelLayerContext.Provider>
      <ViewportOverlay gate={gate} />
      {dropping && <div className="drop-hint">Drop a .glb or .gltf file to import it</div>}
    </div>
  )
}
