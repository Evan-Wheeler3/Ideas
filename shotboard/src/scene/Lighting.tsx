// The shot's environment (sky / background, sun, ambient light, fog, exposure) and its lights.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sky } from '@react-three/drei'
import type { DirectionalLight, Object3D, SpotLight } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import type { Environment as Env, SceneObject } from '../shared/types'
import { ENVIRONMENTS, sunPosition } from './environments'
import { lightColor } from './kelvin'

RectAreaLightUniformsLib.init()

/** Background, sun, ambient light, reflections, fog and exposure for a shot. */
export function SceneEnvironment({ env }: { env: Env }) {
  const def = ENVIRONMENTS[env.preset] ?? ENVIRONMENTS.studio
  const gl = useThree((s) => s.gl)
  const sunPos = useMemo(() => sunPosition(def.sun.elevation, def.sun.azimuth), [def])
  const sunColor = useMemo(() => lightColor(def.sun.kelvin), [def])
  const useSky = env.background === 'sky'

  useEffect(() => {
    gl.toneMappingExposure = Math.pow(2, env.exposure ?? 0)
  }, [gl, env.exposure])

  return (
    <>
      {useSky ? (
        <Sky distance={4500} sunPosition={sunPos} turbidity={env.preset === 'sunset' ? 8 : 4} rayleigh={env.preset === 'sunset' ? 3 : 1.2} mieCoefficient={0.005} mieDirectionalG={0.8} />
      ) : (
        <color attach="background" args={[env.color]} />
      )}
      <fog attach="fog" args={[useSky ? def.color : env.color, def.fog[0], def.fog[1]]} />
      <hemisphereLight args={[def.hemi.sky, def.hemi.ground, def.hemi.intensity]} />
      <directionalLight
        position={sunPos}
        color={sunColor}
        intensity={def.sun.intensity}
        castShadow={def.sun.intensity > 0}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={def.sun.softness}
      />
      {/* Procedural environment for soft reflections; no network needed. */}
      <Environment resolution={256} frames={1} environmentIntensity={def.reflections}>
        <Lightformer form="rect" intensity={2} position={[0, 5, -5]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
    </>
  )
}

/** Physical-ish units for the 0–10 brightness scale, per light type. */
const UNITS = { directional: 0.8, point: 2.5, spot: 12, area: 2.5 }

/** The light itself (no helper geometry), shining along the parent's local -Z. */
export function LightSource({ obj }: { obj: SceneObject }) {
  const l = obj.light!
  const color = useMemo(() => lightColor(l.kelvin, l.color), [l.kelvin, l.color])
  const intensity = l.intensity * UNITS[l.type]
  const lightRef = useRef<SpotLight | DirectionalLight>(null)
  const target = useRef<Object3D>(null)

  useLayoutEffect(() => {
    if (lightRef.current && target.current) lightRef.current.target = target.current
  }, [l.type])

  const shadowProps = {
    castShadow: l.shadows,
    'shadow-mapSize': [1024, 1024] as [number, number],
    'shadow-bias': -0.0005,
    'shadow-normalBias': 0.02,
    'shadow-radius': 4
  }

  return (
    <>
      <object3D ref={target} position={[0, 0, -1]} />
      {l.type === 'spot' && (
        <spotLight
          ref={lightRef as React.RefObject<SpotLight>}
          color={color}
          intensity={intensity}
          angle={((l.angle ?? 35) * Math.PI) / 360}
          penumbra={0.6}
          decay={2}
          distance={0}
          {...shadowProps}
        />
      )}
      {l.type === 'directional' && (
        <directionalLight
          ref={lightRef as React.RefObject<DirectionalLight>}
          color={color}
          intensity={intensity}
          {...shadowProps}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
      )}
      {l.type === 'point' && <pointLight color={color} intensity={intensity} decay={2} distance={0} {...shadowProps} />}
      {/* Area lights take their size from the object's scale; three ignores the group scale for them. */}
      {l.type === 'area' && <rectAreaLight color={color} intensity={intensity} width={obj.scale[0]} height={obj.scale[1]} />}
    </>
  )
}
