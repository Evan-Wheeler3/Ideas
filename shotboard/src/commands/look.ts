// The look of a shot: its environment, lighting preset and lights.
import type { Environment, LightingPreset, Project, SceneObject } from '../shared/types'
import type { Command } from './command'

const clone = <T>(v: T): T => structuredClone(v)

export interface Look {
  environment: Environment
  lightingPreset: LightingPreset
  objects: SceneObject[]
}

function shotOf(p: Project, shotId: string) {
  const shot = p.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot ${shotId} not found`)
  return shot
}

const apply = (shotId: string, look: Look) => (p: Project) => {
  const scene = shotOf(p, shotId).scene
  scene.environment = clone(look.environment)
  scene.lightingPreset = look.lightingPreset
  scene.objects = clone(look.objects)
}

/** Replace a shot's environment, preset and objects in one step (used by lighting presets). */
export function setLook(shotId: string, before: Look, after: Look, label: string): Command {
  return { label, shotId, do: apply(shotId, after), undo: apply(shotId, before) }
}

interface EnvCommand extends Command {
  readonly after: Partial<Environment>
}

/** Change environment settings (preset, background, exposure). Rapid edits merge. */
export function updateEnvironment(shotId: string, before: Partial<Environment>, after: Partial<Environment>, label: string, mergeable = false): EnvCommand {
  const mergeKey = mergeable ? `env:${shotId}:${Object.keys(after).sort().join(',')}` : undefined
  return {
    label,
    shotId,
    after,
    mergeKey,
    do: (p) => void Object.assign(shotOf(p as Project, shotId).scene.environment, clone(after)),
    undo: (p) => void Object.assign(shotOf(p as Project, shotId).scene.environment, clone(before)),
    merge: (n) => (mergeKey && n.mergeKey === mergeKey ? updateEnvironment(shotId, before, (n as EnvCommand).after, label, true) : null)
  }
}
