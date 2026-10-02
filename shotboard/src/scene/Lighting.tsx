import { Environment, Lightformer } from '@react-three/drei'

/** Neutral studio lighting for the editor. Real lighting setups arrive in milestone 5. */
export function StudioLighting() {
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

