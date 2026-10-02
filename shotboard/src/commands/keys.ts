import type { CameraKey, Project, Shake } from '../shared/types'
import type { Command } from './command'

const clone = <T>(v: T): T => structuredClone(v)
const sorted = (keys: CameraKey[]) => [...keys].sort((a, b) => a.t - b.t)

function shotOf(p: Project, shotId: string) {
  const shot = p.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot ${shotId} not found`)
  return shot
}

interface KeysCommand extends Command {
  readonly after: CameraKey[]
}

/**
 * Replace a shot's camera keys (add, edit, move, delete, preset moves). Keys are small, so the
 * command simply keeps both lists. Pass a mergeKey to fold rapid edits into one undo step.
 */
export function setKeys(shotId: string, before: CameraKey[], after: CameraKey[], label: string, mergeKey?: string): KeysCommand {
  const next = sorted(after)
  return {
    label,
    shotId,
    after: next,
    mergeKey: mergeKey && `keys:${shotId}:${mergeKey}`,
    do: (p) => void (shotOf(p as Project, shotId).keys = clone(next)),
    undo: (p) => void (shotOf(p as Project, shotId).keys = clone(before)),
    merge: (n) => (mergeKey && n.mergeKey === `keys:${shotId}:${mergeKey}` ? setKeys(shotId, before, (n as KeysCommand).after, label, mergeKey) : null)
  }
}

export function setShake(shotId: string, before: Shake, after: Shake): Command {
  return {
    label: after.intensity ? 'Handheld shake' : 'Remove handheld shake',
    shotId,
    do: (p) => void (shotOf(p as Project, shotId).shake = clone(after)),
    undo: (p) => void (shotOf(p as Project, shotId).shake = clone(before))
  }
}
