// Changing the shot camera, keyframes and playback.
//
// Rule: if a shot has no keyframes, camera edits change its one fixed camera. Once it has
// keyframes, moving the camera (or its focal length / focus) sets a keyframe at the playhead,
// so you build a move by scrubbing to a time and framing the shot.
import { useEffect, useMemo } from 'react'
import type { Camera, CameraKey, Ease, Shot } from '../shared/types'
import { newId } from '../shared/defaults'
import { cameraAt, keyedPose, poseOf, snapToFrame, type CameraPose } from '../camera/animate'
import { moveKeys, MOVES, type MoveId } from '../camera/moves'
import { composite, type Command } from '../commands/command'
import { updateCamera } from '../commands/project'
import { setKeys, setShake } from '../commands/keys'
import { toast } from '../components/Dialogs'
import { getActiveShot, useActiveShot, useStore } from './store'

const POSE_FIELDS = ['position', 'rotation', 'focalLength', 'focusDistance'] as const
type PoseField = (typeof POSE_FIELDS)[number]

const fps = () => useStore.getState().project.settings.fps
const now = () => snapToFrame(Math.min(useStore.getState().playhead, getActiveShot().duration), fps())
/** Two keys closer than half a frame are the same key. */
const keyAt = (shot: Shot, t: number) => shot.keys.find((k) => Math.abs(k.t - t) < 0.5 / fps())

/** The camera as shown right now: keyed pose at the playhead, plus shake only while playing. */
export function useDisplayCamera(): Camera {
  const shot = useActiveShot()
  const playhead = useStore((s) => s.playhead)
  const playing = useStore((s) => s.playing)
  return useMemo(
    () => (playing ? cameraAt(shot, playhead) : { ...shot.camera, ...keyedPose(shot, playhead) }),
    [shot, playhead, playing]
  )
}

export const displayCamera = (): Camera => {
  const shot = getActiveShot()
  return { ...shot.camera, ...keyedPose(shot, useStore.getState().playhead) }
}

/** Build the command for a camera change on the active shot (see the rule at the top). */
function cameraChange(after: Partial<Camera>, label: string, mergeable: boolean): Command | null {
  const shot = getActiveShot()
  const posePatch = Object.fromEntries(Object.entries(after).filter(([k]) => POSE_FIELDS.includes(k as PoseField))) as Partial<CameraPose>
  const lensPatch = Object.fromEntries(Object.entries(after).filter(([k]) => !POSE_FIELDS.includes(k as PoseField))) as Partial<Camera>
  const cmds: Command[] = []

  if (Object.keys(lensPatch).length) {
    const before = Object.fromEntries(Object.keys(lensPatch).map((k) => [k, shot.camera[k as keyof Camera]])) as Partial<Camera>
    cmds.push(updateCamera(shot.id, before, lensPatch, label, mergeable))
  }
  if (Object.keys(posePatch).length) {
    if (shot.keys.length === 0) {
      const before = Object.fromEntries(Object.keys(posePatch).map((k) => [k, shot.camera[k as PoseField]])) as Partial<Camera>
      cmds.push(updateCamera(shot.id, before, posePatch, label, mergeable))
    } else {
      const t = now()
      const existing = keyAt(shot, t)
      const keys = existing
        ? shot.keys.map((k) => (k === existing ? { ...k, ...posePatch } : k))
        : [...shot.keys, { id: newId(), t, ...keyedPose(shot, t), ...posePatch, ease: easeBefore(shot, t) }]
      cmds.push(setKeys(shot.id, shot.keys, keys, existing ? `${label} (key at ${t.toFixed(2)}s)` : `${label} (new key at ${t.toFixed(2)}s)`, mergeable ? `edit:${t}` : undefined))
    }
  }
  if (!cmds.length) return null
  return cmds.length === 1 ? cmds[0] : composite(label, cmds)
}

/** A new key between two others keeps the easing of the move it splits. */
const easeBefore = (shot: Shot, t: number): Ease => [...shot.keys].reverse().find((k) => k.t < t)?.ease ?? 'easeInOut'

export function applyCameraChange(after: Partial<Camera>, label: string, mergeable = false): void {
  const cmd = cameraChange(after, label, mergeable)
  if (cmd) useStore.getState().run(cmd)
}

/* ---------------- keyframes ---------------- */

/** K: record the camera as it is now at the playhead (the first key also starts the move). */
export function addKeyAtPlayhead(): void {
  const shot = getActiveShot()
  const t = now()
  const pose = { ...poseOf(shot.camera), ...keyedPose(shot, t) }
  const existing = keyAt(shot, t)
  if (existing) {
    useStore.getState().selectKey(existing.id)
    toast(`There's already a key at ${t.toFixed(2)}s. Move the camera to update it.`, 'info')
    return
  }
  const key: CameraKey = { id: newId(), t, ...pose, ease: easeBefore(shot, t) }
  useStore.getState().run(setKeys(shot.id, shot.keys, [...shot.keys, key], `Add camera key at ${t.toFixed(2)}s`))
  useStore.getState().selectKey(key.id)
}

export function deleteKey(id: string): void {
  const shot = getActiveShot()
  const key = shot.keys.find((k) => k.id === id)
  if (!key) return
  const keys = shot.keys.filter((k) => k.id !== id)
  // Removing the last key leaves the camera where that key had it.
  const cmds: Command[] = [setKeys(shot.id, shot.keys, keys, `Delete camera key at ${key.t.toFixed(2)}s`)]
  if (keys.length === 0) cmds.unshift(updateCamera(shot.id, poseOf(shot.camera), poseOf(key), 'Keep camera position', false))
  useStore.getState().run(cmds.length === 1 ? cmds[0] : composite(`Delete camera key at ${key.t.toFixed(2)}s`, cmds))
  useStore.getState().selectKey(null)
}

export function moveKey(id: string, t: number): void {
  const shot = getActiveShot()
  const key = shot.keys.find((k) => k.id === id)
  const snapped = snapToFrame(Math.min(Math.max(t, 0), shot.duration), fps())
  if (!key || Math.abs(key.t - snapped) < 1e-6) return
  if (shot.keys.some((k) => k.id !== id && Math.abs(k.t - snapped) < 0.5 / fps())) {
    toast('Another key is already at that time.', 'info')
    return
  }
  useStore.getState().run(setKeys(shot.id, shot.keys, shot.keys.map((k) => (k.id === id ? { ...k, t: snapped } : k)), `Move camera key to ${snapped.toFixed(2)}s`))
}

export function setKeyEase(id: string, ease: Ease): void {
  const shot = getActiveShot()
  useStore.getState().run(setKeys(shot.id, shot.keys, shot.keys.map((k) => (k.id === id ? { ...k, ease } : k)), 'Change easing'))
}

export function clearKeys(): void {
  const shot = getActiveShot()
  if (!shot.keys.length) return
  // Keep the camera where it is at the playhead, as the shot's fixed camera.
  const pose = keyedPose(shot, now())
  useStore.getState().run(
    composite('Clear camera move', [updateCamera(shot.id, poseOf(shot.camera), pose, 'Keep camera position', false), setKeys(shot.id, shot.keys, [], 'Clear camera move')])
  )
  useStore.getState().selectKey(null)
}

/** Replace the shot's move with a preset, starting from the camera as it is at the playhead. */
export function applyMove(move: MoveId, amount = 1): void {
  const shot = getActiveShot()
  const start = keyedPose(shot, now())
  const keys = moveKeys(move, start, shot.duration, amount, newId)
  const label = MOVES.find((m) => m.id === move)?.label ?? 'Camera move'
  useStore.getState().run(setKeys(shot.id, shot.keys, keys, label))
  useStore.getState().selectKey(null)
}

export const SHAKE_LEVELS = [
  { label: 'Off', intensity: 0 },
  { label: 'Subtle', intensity: 0.25 },
  { label: 'Handheld', intensity: 0.55 },
  { label: 'Rough', intensity: 1 }
]

export function setHandheld(intensity: number): void {
  const shot = getActiveShot()
  if (shot.shake.intensity === intensity) return
  useStore.getState().run(setShake(shot.id, shot.shake, { ...shot.shake, intensity }))
}

/* ---------------- playback ---------------- */

export function togglePlay(scope: 'shot' | 'sequence'): void {
  const s = useStore.getState()
  if (s.playing) s.pause()
  else s.play(scope)
}

export function stepFrames(n: number): void {
  const s = useStore.getState()
  s.pause()
  const shot = getActiveShot()
  s.setPlayhead(Math.min(Math.max(snapToFrame(s.playhead + n / fps(), fps()), 0), shot.duration))
}

/**
 * Drives the playhead from the wall clock while playing. Time comes from "now − start", not from
 * adding up frame times, so slow frames are dropped and playback never drifts from real time.
 */
export function usePlayback(): void {
  const playing = useStore((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let start = performance.now()
    // Where playback started: shot time, or position in the whole sequence for the animatic.
    const s0 = useStore.getState()
    let base = s0.playScope === 'sequence' ? sequenceTiming(s0.project.shots, s0.activeShotId).start + s0.playhead : s0.playhead
    let raf = 0

    const tick = () => {
      const time = performance.now()
      const s = useStore.getState()
      if (!s.playing) return
      const elapsed = (time - start) / 1000
      if (s.playScope === 'shot') {
        const shot = getActiveShot()
        let t = base + elapsed
        if (t >= shot.duration) {
          if (!s.loop) return useStore.setState({ playing: false, playhead: shot.duration })
          start = time
          base = 0
          t = 0
        }
        s.setPlayhead(t)
      } else {
        const shots = s.project.shots
        const total = shots.reduce((sum, x) => sum + x.duration, 0)
        let g = base + elapsed
        if (g >= total) {
          if (!s.loop) {
            const last = shots[shots.length - 1]
            return useStore.setState({ playing: false, activeShotId: last.id, playhead: last.duration })
          }
          start = time
          base = 0
          g = 0
        }
        // Find the shot playing at sequence time g.
        let acc = 0
        let shot = shots[0]
        for (const x of shots) {
          shot = x
          if (g < acc + x.duration) break
          acc += x.duration
        }
        if (shot.id !== s.activeShotId) useStore.setState({ activeShotId: shot.id, selection: [], joint: null, selectedKeyId: null })
        s.setPlayhead(g - acc)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}

/** Total length of the sequence and where the active shot starts in it. */
export function sequenceTiming(shots: Shot[], activeId: string): { total: number; start: number } {
  let start = 0
  let total = 0
  for (const s of shots) {
    if (s.id === activeId) start = total
    total += s.duration
  }
  return { total, start }
}
