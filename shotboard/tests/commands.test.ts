import { describe, expect, it } from 'vitest'
import { emptyHistory, execute, isDirty, redo, undo, MERGE_WINDOW_MS, type HistoryState } from '../src/commands/command'
import { addObject, deleteObjects, duplicateObjects, updateObject } from '../src/commands/objects'
import { makeObject, makeStarterProject } from '../src/shared/defaults'
import type { Project } from '../src/shared/types'

function setup() {
  const project = makeStarterProject()
  return { project, history: emptyHistory(), shotId: project.shots[0].id }
}

const objects = (p: Project) => p.shots[0].scene.objects

describe('history', () => {
  it('adds, undoes and redoes an object', () => {
    let { project, history, shotId } = setup()
    const before = project
    const box = makeObject('box')
    ;({ project, history } = execute(project, history, addObject(shotId, box)))
    expect(objects(project).at(-1)?.id).toBe(box.id)
    expect(isDirty(history)).toBe(true)

    const u = undo(project, history)!
    expect(u.project).toEqual(before)
    expect(isDirty(u.history)).toBe(false)

    const r = redo(u.project, u.history)!
    expect(objects(r.project).at(-1)?.id).toBe(box.id)
  })

  it('does not mutate the previous project', () => {
    const { project, history, shotId } = setup()
    const snapshot = structuredClone(project)
    execute(project, history, addObject(shotId, makeObject('sphere')))
    expect(project).toEqual(snapshot)
  })

  it('restores deleted objects at their original positions', () => {
    let { project, history, shotId } = setup()
    const original = objects(project).map((o) => o.id)
    const toDelete = [objects(project)[1], objects(project)[3]]
    ;({ project, history } = execute(project, history, deleteObjects(shotId, toDelete, objects(project))))
    expect(objects(project)).toHaveLength(original.length - 2)
    const u = undo(project, history)!
    expect(objects(u.project).map((o) => o.id)).toEqual(original)
  })

  it('merges rapid edits of the same field into one undo step', () => {
    let { project, history, shotId } = setup()
    const obj = objects(project)[1]
    const t0 = 1_000_000
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { position: obj.position }, { position: [1, 0, 0] }), t0))
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { position: [1, 0, 0] }, { position: [2, 0, 0] }), t0 + 100))
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { position: [2, 0, 0] }, { position: [3, 0, 0] }), t0 + 200))
    expect(history.past).toHaveLength(1)
    expect(objects(project)[1].position).toEqual([3, 0, 0])
    const u = undo(project, history)!
    expect(objects(u.project)[1].position).toEqual(obj.position)
  })

  it('keeps edits separate when they are far apart in time or touch different fields', () => {
    let { project, history, shotId } = setup()
    const obj = objects(project)[1]
    const t0 = 1_000_000
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { position: obj.position }, { position: [1, 0, 0] }), t0))
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { position: [1, 0, 0] }, { position: [2, 0, 0] }), t0 + MERGE_WINDOW_MS + 1))
    ;({ project, history } = execute(project, history, updateObject(shotId, obj.id, { color: obj.color }, { color: '#ff0000' }), t0 + MERGE_WINDOW_MS + 50))
    expect(history.past).toHaveLength(3)
  })

  it('duplicates several objects as one undo step', () => {
    let { project, history, shotId } = setup()
    const count = objects(project).length
    const copies = [makeObject('box'), makeObject('cone')]
    ;({ project, history } = execute(project, history, duplicateObjects(shotId, copies)))
    expect(objects(project)).toHaveLength(count + 2)
    expect(history.past).toHaveLength(1)
    expect(objects(undo(project, history)!.project)).toHaveLength(count)
  })

  it('clears redo after a new command', () => {
    let { project, history, shotId } = setup()
    ;({ project, history } = execute(project, history, addObject(shotId, makeObject('box'))))
    const u = undo(project, history)!
    const next = execute(u.project, u.history, addObject(shotId, makeObject('sphere')))
    expect(next.history.future).toHaveLength(0)
    expect(redo(next.project, next.history)).toBeNull()
  })

  it('caps history length and keeps dirty tracking correct', () => {
    let { project, history, shotId } = setup()
    for (let i = 0; i < 205; i++) {
      ;({ project, history } = execute(project, history, addObject(shotId, makeObject('box'))))
    }
    expect(history.past).toHaveLength(200)
    expect(history.savedAt).toBe(-1)
    expect(isDirty(history)).toBe(true)
  })

  it('treats undoing back to the save point as clean', () => {
    let { project, history, shotId } = setup()
    ;({ project, history } = execute(project, history, addObject(shotId, makeObject('box'))))
    history = { ...history, savedAt: history.past.length } satisfies HistoryState
    ;({ project, history } = execute(project, history, addObject(shotId, makeObject('box'))))
    expect(isDirty(history)).toBe(true)
    expect(isDirty(undo(project, history)!.history)).toBe(false)
  })
})
