// The .shotboard file: a zip holding
//   project.json        the project (versioned, see SCHEMA_VERSION)
//   thumbs.json         { shotId: hash } for the thumbnails below
//   thumbs/<shotId>.jpg shot thumbnails (a cache; the app re-renders missing or stale ones)
//   assets/<id>.glb     imported models, so the project is self-contained
import JSZip from 'jszip'
import type { Project, Shot } from '../shared/types'
import { SCHEMA_VERSION } from '../shared/types'
import { DEFAULT_COLUMNS, makeCamera } from '../shared/defaults'
import type { Thumb } from '../store/thumbs'

export const FILE_EXTENSION = 'shotboard'

export interface ProjectBundle {
  project: Project
  thumbs: Record<string, Thumb>
  assets: Record<string, ArrayBuffer>
}

export class ProjectFileError extends Error {}

/* ---------- data URL helpers (thumbnails are kept as JPEG data URLs in memory) ---------- */

function dataUrlToBytes(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(',') + 1)
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return `data:${mime};base64,${btoa(bin)}`
}

/* ---------- write ---------- */

export async function serializeProject(bundle: ProjectBundle): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(bundle.project, null, 2))
  const hashes: Record<string, string> = {}
  for (const shot of bundle.project.shots) {
    const t = bundle.thumbs[shot.id]
    if (!t) continue
    zip.file(`thumbs/${shot.id}.jpg`, dataUrlToBytes(t.url))
    hashes[shot.id] = t.hash
  }
  zip.file('thumbs.json', JSON.stringify(hashes))
  for (const id of Object.keys(bundle.project.assets)) {
    const data = bundle.assets[id]
    if (data) zip.file(`assets/${id}.glb`, data)
  }
  // Thumbnails and models are already compressed; only squeeze the JSON.
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

/* ---------- read ---------- */

type Migration = (p: Record<string, unknown>) => Record<string, unknown>
/** MIGRATIONS[n] upgrades a version-n project to version n+1. */
const MIGRATIONS: Record<number, Migration> = {}

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let version = raw.schemaVersion
  if (typeof version !== 'number') throw new ProjectFileError('This file has no version number; it may not be a ShotBoard project.')
  if (version > SCHEMA_VERSION) {
    throw new ProjectFileError('This project was saved by a newer version of ShotBoard. Please update the app to open it.')
  }
  let p = raw
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new ProjectFileError(`Can't upgrade projects from version ${version}.`)
    p = step(p)
    version++
  }
  return { ...p, schemaVersion: SCHEMA_VERSION }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/** Check the shape of a project and fill in any optional fields that are missing. */
export function validateProject(raw: unknown): Project {
  if (!isObj(raw)) throw new ProjectFileError('project.json is not a project.')
  const p = migrate(raw)
  if (!Array.isArray(p.shots) || p.shots.length === 0) throw new ProjectFileError('The project has no shots.')

  const shots = p.shots.map((s: unknown, i: number): Shot => {
    if (!isObj(s) || typeof s.id !== 'string') throw new ProjectFileError(`Shot ${i + 1} is damaged.`)
    const scene = isObj(s.scene) ? s.scene : {}
    const objects = Array.isArray(scene.objects) ? scene.objects : []
    for (const o of objects) {
      if (!isObj(o) || typeof o.id !== 'string' || !isVec3(o.position) || !isVec3(o.rotation) || !isVec3(o.scale)) {
        throw new ProjectFileError(`An object in shot ${i + 1} is damaged.`)
      }
    }
    const cam = isObj(s.camera) && isVec3(s.camera.position) && isVec3(s.camera.rotation) ? s.camera : makeCamera()
    return {
      ...(s as unknown as Shot),
      number: typeof s.number === 'string' ? s.number : String(i + 1),
      numberLocked: s.numberLocked === true,
      type: (s.type as Shot['type']) ?? 'OTHER',
      duration: typeof s.duration === 'number' && s.duration > 0 ? s.duration : 3,
      notes: typeof s.notes === 'string' ? s.notes : '',
      fields: isObj(s.fields) ? (s.fields as Shot['fields']) : {},
      keys: Array.isArray(s.keys)
        ? (s.keys as Shot['keys'])
            .filter((k) => isObj(k) && typeof k.t === 'number' && isVec3(k.position) && isVec3(k.rotation))
            .map((k, j) => ({ ...k, ease: k.ease ?? 'easeInOut', id: typeof k.id === 'string' ? k.id : `k${j}` }))
            .sort((a, b) => a.t - b.t)
        : [],
      shake: isObj(s.shake) && typeof s.shake.intensity === 'number' ? (s.shake as unknown as Shot['shake']) : { intensity: 0, seed: 1 },
      camera: cam as unknown as Shot['camera'],
      scene: {
        lightingPreset: 'none',
        ...(scene as object),
        environment: {
          preset: 'studio',
          background: 'color',
          color: '#1b1d22',
          exposure: 0,
          ...(isObj(scene.environment) ? scene.environment : {})
        },
        objects: objects.map((o) => ({ visible: true, ...(o as object) }))
      } as Shot['scene']
    }
  })

  const settings = isObj(p.settings) ? p.settings : {}
  return {
    schemaVersion: SCHEMA_VERSION,
    title: typeof p.title === 'string' ? p.title : 'Untitled',
    meta: isObj(p.meta) ? (p.meta as Project['meta']) : {},
    settings: { fps: 24, aspect: '2.39', exportWidth: 1920, ...(settings as object) } as Project['settings'],
    shotColumns: Array.isArray(p.shotColumns) ? (p.shotColumns as Project['shotColumns']) : DEFAULT_COLUMNS.map((c) => ({ ...c })),
    shots,
    assets: isObj(p.assets) ? (p.assets as Project['assets']) : {}
  }
}

export async function deserializeProject(data: ArrayBuffer | Uint8Array): Promise<ProjectBundle> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new ProjectFileError("This file isn't a ShotBoard project (it couldn't be unpacked).")
  }
  const json = zip.file('project.json')
  if (!json) throw new ProjectFileError('This file is missing project.json.')
  let raw: unknown
  try {
    raw = JSON.parse(await json.async('string'))
  } catch {
    throw new ProjectFileError('project.json is damaged and could not be read.')
  }
  const project = validateProject(raw)

  const thumbs: Record<string, Thumb> = {}
  const hashFile = zip.file('thumbs.json')
  const hashes: Record<string, string> = hashFile ? JSON.parse(await hashFile.async('string')) : {}
  for (const shot of project.shots) {
    const f = zip.file(`thumbs/${shot.id}.jpg`)
    if (f) thumbs[shot.id] = { url: bytesToDataUrl(await f.async('uint8array'), 'image/jpeg'), hash: hashes[shot.id] ?? '' }
  }

  const assets: Record<string, ArrayBuffer> = {}
  for (const id of Object.keys(project.assets)) {
    const f = zip.file(`assets/${id}.glb`)
    if (f) assets[id] = await f.async('arraybuffer')
  }
  return { project, thumbs, assets }
}
