// Lighting and environment actions.
import type { Environment, EnvironmentPreset, LightingPreset } from '../shared/types'
import { composite } from '../commands/command'
import { setLook, updateEnvironment, type Look } from '../commands/look'
import { presetEnvironment, presetLook, LIGHTING_PRESETS } from '../scene/lightingPresets'
import { ENVIRONMENTS } from '../scene/environments'
import { toast } from '../components/Dialogs'
import { displayCamera } from './cameraActions'
import { getActiveShot, useStore } from './store'

const lookOf = (shot = getActiveShot()): Look => ({
  environment: shot.scene.environment,
  lightingPreset: shot.scene.lightingPreset,
  objects: shot.scene.objects
})

/** Apply a lighting preset: set the environment and replace any lights an earlier preset added. */
export function applyLightingPreset(preset: Exclude<LightingPreset, 'none'>): void {
  const shot = getActiveShot()
  const { env, lights } = presetLook(preset, displayCamera())
  const kept = shot.scene.objects.filter((o) => !o.fromPreset)
  const after: Look = {
    environment: presetEnvironment(env, shot.scene.environment.exposure),
    lightingPreset: preset,
    objects: [...kept, ...lights]
  }
  const label = LIGHTING_PRESETS.find((p) => p.id === preset)?.label ?? 'Lighting'
  useStore.getState().run(setLook(shot.id, lookOf(shot), after, `Lighting: ${label}`))
}

export function setEnvironmentPreset(preset: EnvironmentPreset): void {
  const shot = getActiveShot()
  const env = shot.scene.environment
  const after = presetEnvironment(preset, env.exposure)
  useStore.getState().run(updateEnvironment(shot.id, env, after, `Environment: ${ENVIRONMENTS[preset].label}`))
}

export function changeEnvironment(patch: Partial<Environment>, label: string, mergeable = false): void {
  const shot = getActiveShot()
  const env = shot.scene.environment
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, env[k as keyof Environment]])) as Partial<Environment>
  useStore.getState().run(updateEnvironment(shot.id, before, patch, label, mergeable))
}

/** Give every shot this shot's environment and lights (the rest of each set is left alone). */
export function applyLookToAllShots(): void {
  const { project, run } = useStore.getState()
  const source = getActiveShot()
  const lights = source.scene.objects.filter((o) => o.kind === 'light')
  const cmds = project.shots
    .filter((s) => s.id !== source.id)
    .map((s) =>
      setLook(s.id, lookOf(s), {
        environment: source.scene.environment,
        lightingPreset: source.scene.lightingPreset,
        objects: [...s.scene.objects.filter((o) => o.kind !== 'light'), ...structuredClone(lights)]
      }, 'Copy lighting')
    )
  if (!cmds.length) return
  run({ ...composite('Copy lighting to all shots', cmds), shotId: source.id })
  toast(`Lighting copied to ${cmds.length} other ${cmds.length === 1 ? 'shot' : 'shots'}`)
}
