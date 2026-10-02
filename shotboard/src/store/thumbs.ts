// Shot thumbnails. They're a cache rendered from each shot's camera, so they live outside the
// undoable project. `hash` records what the picture was rendered from, to spot stale ones.
import { create } from 'zustand'
import type { AspectRatio, Shot } from '../shared/types'

export interface Thumb {
  /** JPEG data URL. */
  url: string
  hash: string
}

interface ThumbState {
  byShot: Record<string, Thumb>
  put(shotId: string, thumb: Thumb): void
  replaceAll(byShot: Record<string, Thumb>): void
}

export const useThumbs = create<ThumbState>((set) => ({
  byShot: {},
  put: (shotId, thumb) => set((s) => ({ byShot: { ...s.byShot, [shotId]: thumb } })),
  replaceAll: (byShot) => set({ byShot })
}))

/** FNV-1a: a fast, stable string hash. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// Shots are immutable, so a shot object's hash never changes. Cache it per object.
const cache = new WeakMap<Shot, Map<string, string>>()

/** What a shot's thumbnail depends on: its scene, its camera, and the frame shape. */
export function shotHash(shot: Shot, aspect: AspectRatio): string {
  let perAspect = cache.get(shot)
  if (!perAspect) cache.set(shot, (perAspect = new Map()))
  let h = perAspect.get(aspect)
  if (!h) {
    h = fnv1a(JSON.stringify([shot.scene, shot.camera, aspect]))
    perAspect.set(aspect, h)
  }
  return h
}
