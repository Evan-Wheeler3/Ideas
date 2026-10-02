import { describe, expect, it } from 'vitest'
import { emptyHistory, execute, undo } from '../src/commands/command'
import { addShot, deleteShot, moveShot, renumber, updateShot } from '../src/commands/shots'
import { makeShot } from '../src/shared/defaults'
import { makeSampleProject } from '../src/shared/sample'

const numbers = (p: { shots: { number: string }[] }) => p.shots.map((s) => s.number)

describe('shot list', () => {
  it('renumbers after adding, deleting and reordering', () => {
    let project = makeSampleProject()
    let history = emptyHistory()
    const shots = project.shots

    ;({ project, history } = execute(project, history, addShot(project.shots, makeShot('?'), 1)))
    expect(numbers(project)).toEqual(['1', '2', '3', '4', '5', '6', '7'])

    ;({ project, history } = execute(project, history, deleteShot(project.shots, project.shots[0].id)))
    expect(numbers(project)).toEqual(['1', '2', '3', '4', '5', '6'])

    const last = project.shots.at(-1)!.id
    ;({ project, history } = execute(project, history, moveShot(project.shots, last, 0)))
    expect(project.shots[0].id).toBe(last)
    expect(numbers(project)).toEqual(['1', '2', '3', '4', '5', '6'])

    // Undo all three steps: back to the original list, shot for shot.
    for (let i = 0; i < 3; i++) ({ project, history } = undo(project, history)!)
    expect(project.shots.map((s) => s.id)).toEqual(shots.map((s) => s.id))
  })

  it('keeps typed-in shot numbers when renumbering', () => {
    const shots = makeSampleProject().shots
    shots[2] = { ...shots[2], number: '3A', numberLocked: true }
    const moved = renumber([shots[2], ...shots.filter((_, i) => i !== 2)])
    expect(numbers({ shots: moved })).toEqual(['3A', '2', '3', '4', '5', '6'])
  })

  it('merges rapid duration edits and records the shot they belong to', () => {
    let project = makeSampleProject()
    let history = emptyHistory()
    const id = project.shots[1].id
    ;({ project, history } = execute(project, history, updateShot(id, { duration: 5 }, { duration: 5.5 }), 1000))
    ;({ project, history } = execute(project, history, updateShot(id, { duration: 5.5 }, { duration: 6 }), 1100))
    expect(history.past).toHaveLength(1)
    expect(history.past[0].shotId).toBe(id)
    expect(undo(project, history)!.project.shots[1].duration).toBe(5)
  })

  it('builds a valid sample project', () => {
    const p = makeSampleProject()
    expect(p.shots).toHaveLength(6)
    expect(new Set(p.shots.map((s) => s.id)).size).toBe(6)
    expect(p.shotColumns.map((c) => c.id)).toContain('location')
    for (const s of p.shots) expect(s.camera.focusDistance).toBeGreaterThan(0.5)
  })
})
