import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { deserializeProject, serializeProject, validateProject, ProjectFileError } from '../src/persist/projectFile'
import { makeSampleProject } from '../src/shared/sample'
import { makeStarterProject } from '../src/shared/defaults'
import { SCHEMA_VERSION } from '../src/shared/types'

// A 1×1 JPEG-ish payload is enough: the file stores whatever bytes the data URL holds.
const FAKE_JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3]).toString('base64')

describe('project file', () => {
  it('round-trips a project with thumbnails and imported models', async () => {
    const project = makeSampleProject()
    project.assets = { a1: { id: 'a1', name: 'Lamp post', file: 'assets/a1.glb' } }
    const model = new Uint8Array([103, 108, 84, 70, 2, 0, 0, 0]).buffer
    const thumbs = { [project.shots[0].id]: { url: FAKE_JPEG, hash: 'h1' } }

    const bytes = await serializeProject({ project, thumbs, assets: { a1: model } })
    const back = await deserializeProject(bytes)

    expect(back.project).toEqual(project)
    expect(back.thumbs).toEqual(thumbs)
    expect(new Uint8Array(back.assets.a1)).toEqual(new Uint8Array(model))
  })

  it('rejects files that are not projects', async () => {
    await expect(deserializeProject(new Uint8Array([1, 2, 3]))).rejects.toThrow(ProjectFileError)
    const zip = new JSZip()
    zip.file('notes.txt', 'hello')
    await expect(deserializeProject(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/missing project.json/)
  })

  it('refuses projects from a newer version of the app', () => {
    const p = { ...makeStarterProject(), schemaVersion: SCHEMA_VERSION + 1 }
    expect(() => validateProject(p)).toThrow(/newer version/)
  })

  it('fills in optional fields missing from older or hand-edited files', () => {
    const p = JSON.parse(JSON.stringify(makeStarterProject()))
    delete p.shotColumns
    delete p.shots[0].numberLocked
    delete p.shots[0].fields
    delete p.shots[0].keys
    delete p.shots[0].scene.objects[0].visible
    const fixed = validateProject(p)
    expect(fixed.shotColumns.length).toBeGreaterThan(0)
    expect(fixed.shots[0].numberLocked).toBe(false)
    expect(fixed.shots[0].fields).toEqual({})
    expect(fixed.shots[0].keys).toEqual([])
    expect(fixed.shots[0].scene.objects[0].visible).toBe(true)
  })

  it('reports damaged objects instead of loading them', () => {
    const p = JSON.parse(JSON.stringify(makeStarterProject()))
    p.shots[0].scene.objects[1].position = [0, 'up', 0]
    expect(() => validateProject(p)).toThrow(/damaged/)
  })
})
