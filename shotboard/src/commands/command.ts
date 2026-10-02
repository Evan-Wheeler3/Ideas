import { produce, type Draft } from 'immer'
import type { Project } from '../shared/types'

/** An undoable change to the project. Only commands may change the project. */
export interface Command {
  readonly label: string
  do(p: Draft<Project>): void
  undo(p: Draft<Project>): void
  /** Commands with the same key, run close together, collapse into one undo step. */
  readonly mergeKey?: string
  /** Return one command that does `this` then `next`, or null if they can't merge. */
  merge?(next: Command): Command | null
}

export const MERGE_WINDOW_MS = 600
const MAX_HISTORY = 200

export interface HistoryState {
  past: Command[]
  future: Command[]
  lastAt: number
  /** Length of `past` at the last save; -1 if the save point was dropped. */
  savedAt: number
}

export const emptyHistory = (): HistoryState => ({ past: [], future: [], lastAt: 0, savedAt: 0 })

export function execute(
  project: Project,
  h: HistoryState,
  cmd: Command,
  now = Date.now()
): { project: Project; history: HistoryState } {
  const next = produce(project, (d) => cmd.do(d))
  const last = h.past[h.past.length - 1]
  const canMerge =
    last && cmd.mergeKey && last.mergeKey === cmd.mergeKey && now - h.lastAt < MERGE_WINDOW_MS && h.savedAt !== h.past.length
  const merged = canMerge ? last.merge?.(cmd) : null

  let past = merged ? [...h.past.slice(0, -1), merged] : [...h.past, cmd]
  let savedAt = h.savedAt > h.past.length ? -1 : h.savedAt
  if (past.length > MAX_HISTORY) {
    const drop = past.length - MAX_HISTORY
    past = past.slice(drop)
    savedAt = savedAt >= drop ? savedAt - drop : -1
  }
  return { project: next, history: { past, future: [], lastAt: now, savedAt } }
}

export function undo(project: Project, h: HistoryState): { project: Project; history: HistoryState } | null {
  const cmd = h.past[h.past.length - 1]
  if (!cmd) return null
  return {
    project: produce(project, (d) => cmd.undo(d)),
    history: { ...h, past: h.past.slice(0, -1), future: [cmd, ...h.future], lastAt: 0 }
  }
}

export function redo(project: Project, h: HistoryState): { project: Project; history: HistoryState } | null {
  const cmd = h.future[0]
  if (!cmd) return null
  return {
    project: produce(project, (d) => cmd.do(d)),
    history: { ...h, past: [...h.past, cmd], future: h.future.slice(1), lastAt: 0 }
  }
}

export const isDirty = (h: HistoryState): boolean => h.savedAt !== h.past.length

/** Several commands as one undo step. */
export function composite(label: string, cmds: Command[]): Command {
  return {
    label,
    do: (p) => cmds.forEach((c) => c.do(p)),
    undo: (p) => [...cmds].reverse().forEach((c) => c.undo(p))
  }
}
