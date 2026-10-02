// A shot's set as it appears on film: environment, objects and lights, with no editor helpers.
// Used for thumbnails and exported frames. Children render inside the same Suspense boundary,
// so they run only once imported models have loaded.
import { Suspense, type ReactNode } from 'react'
import type { Shot } from '../shared/types'
import { assetUrl } from '../store/assets'
import { LightSource, SceneEnvironment } from './Lighting'
import { Mannequin } from './Mannequin'
import { PropModel } from './Props'
import { ImportedModel, MissingModel, SHAPES, Shape } from './SceneObjectView'

const DEG = Math.PI / 180
const noop = () => {}

export function ShotContent({ shot, children }: { shot: Shot; children?: ReactNode }) {
  return (
    <>
      <SceneEnvironment env={shot.scene.environment} />
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
                {o.kind === 'light' && o.light && <LightSource obj={o} />}
              </group>
            )
          })}
        {children}
      </Suspense>
    </>
  )
}
