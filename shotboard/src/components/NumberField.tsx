import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  value: number
  onChange(v: number): void
  step?: number
  precision?: number
  min?: number
  max?: number
  suffix?: string
  /** CSS color for the label (e.g. axis colors). */
  accent?: string
}

const clamp = (v: number, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, v))

/**
 * A number input with a draggable label: drag the label left/right to scrub the value
 * (Shift = fine, Ctrl = coarse), or click into the field to type.
 */
export function NumberField({ label, value, onChange, step = 0.1, precision = 2, min, max, suffix, accent }: Props) {
  const [text, setText] = useState(value.toFixed(precision))
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ x: number; start: number } | null>(null)

  useEffect(() => {
    if (!editing) setText(value.toFixed(precision))
  }, [value, precision, editing])

  // Set while the field is being edited; commit() clears it so Enter + blur never commit twice.
  const active = useRef(false)

  const commit = (apply: boolean) => {
    if (!active.current) return
    active.current = false
    setEditing(false)
    const n = Number.parseFloat(text)
    if (apply && Number.isFinite(n) && n !== value) onChange(clamp(n, min, max))
  }

  return (
    <label className="numfield">
      <span
        className="numfield-label"
        style={accent ? { color: accent } : undefined}
        onPointerDown={(e) => {
          e.preventDefault()
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, start: value }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const mult = e.shiftKey ? 0.1 : e.ctrlKey || e.metaKey ? 10 : 1
          const v = drag.current.start + ((e.clientX - drag.current.x) / 4) * step * mult
          onChange(clamp(Number(v.toFixed(precision)), min, max))
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {label}
      </span>
      <input
        value={editing ? text : `${value.toFixed(precision)}${suffix ?? ''}`}
        onFocus={(e) => {
          active.current = true
          setEditing(true)
          setText(value.toFixed(precision))
          // Select on the next frame (after the click lands). Skip if focus already moved on:
          // select() would otherwise pull focus back when frames are slow.
          const input = e.target
          requestAnimationFrame(() => document.activeElement === input && input.select())
        }}
        onChange={(e) => {
          active.current = true
          setEditing(true)
          setText(e.target.value)
        }}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            commit(e.key === 'Enter')
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </label>
  )
}
