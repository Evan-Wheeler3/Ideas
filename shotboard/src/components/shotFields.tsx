// Editing a shot's details: shared by the shot list's table and the Properties panel.
import type { ColumnDef, Shot, ShotType } from '../shared/types'
import { updateShot } from '../commands/shots'
import type { Command } from '../commands/command'
import { useStore } from '../store/store'
import { EditableText } from './EditableText'

export const SHOT_TYPES: { id: ShotType; label: string }[] = [
  { id: 'WS', label: 'Wide' },
  { id: 'FS', label: 'Full' },
  { id: 'MS', label: 'Medium' },
  { id: 'MCU', label: 'Medium close-up' },
  { id: 'CU', label: 'Close-up' },
  { id: 'ECU', label: 'Extreme close-up' },
  { id: 'OTS', label: 'Over the shoulder' },
  { id: 'POV', label: 'Point of view' },
  { id: 'INSERT', label: 'Insert' },
  { id: 'OTHER', label: 'Other' }
]

export const typeLabel = (t: ShotType) => SHOT_TYPES.find((x) => x.id === t)?.label ?? t

const run = (cmd: Command) => useStore.getState().run(cmd)

export function setShotNumber(shot: Shot, index: number, text: string): void {
  const trimmed = text.trim()
  // Clearing the number goes back to automatic numbering.
  const after = trimmed ? { number: trimmed, numberLocked: true } : { number: String(index + 1), numberLocked: false }
  run(updateShot(shot.id, { number: shot.number, numberLocked: shot.numberLocked }, after, `Renumber shot ${shot.number}`, false))
}

export function setShotType(shot: Shot, type: ShotType): void {
  run(updateShot(shot.id, { type: shot.type }, { type }, `Shot ${shot.number}: ${type}`, false))
}

export function setShotDuration(shot: Shot, seconds: number): void {
  const d = Math.min(Math.max(Math.round(seconds * 10) / 10, 0.1), 600)
  run(updateShot(shot.id, { duration: shot.duration }, { duration: d }, `Shot ${shot.number} duration`))
}

export function setShotNotes(shot: Shot, notes: string): void {
  run(updateShot(shot.id, { notes: shot.notes }, { notes }, `Shot ${shot.number} notes`, false))
}

export function setShotField(shot: Shot, col: ColumnDef, value: string | number): void {
  const fields = { ...shot.fields, [col.id]: value }
  if (value === '') delete fields[col.id]
  run(updateShot(shot.id, { fields: shot.fields }, { fields }, `Shot ${shot.number}: ${col.label}`, false))
}

export function TypeSelect({ shot, className }: { shot: Shot; className?: string }) {
  return (
    <select className={className ?? 'select'} value={shot.type} onChange={(e) => setShotType(shot, e.target.value as ShotType)}>
      {SHOT_TYPES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.id} · {t.label}
        </option>
      ))}
    </select>
  )
}

/** Editor for a custom column's value on one shot. */
export function CustomFieldInput({ shot, col }: { shot: Shot; col: ColumnDef }) {
  const value = shot.fields[col.id] ?? ''
  if (col.kind === 'select') {
    return (
      <select className="select" value={String(value)} onChange={(e) => setShotField(shot, col, e.target.value)}>
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  if (col.kind === 'number') {
    return (
      <EditableText
        value={value === '' ? '' : String(value)}
        placeholder="—"
        onCommit={(t) => {
          const n = Number.parseFloat(t)
          setShotField(shot, col, t.trim() === '' || !Number.isFinite(n) ? '' : n)
        }}
      />
    )
  }
  return <EditableText value={String(value)} placeholder="—" multiline={col.kind === 'longtext'} onCommit={(t) => setShotField(shot, col, t)} />
}
