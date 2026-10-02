// Choose which shot list columns show, in what order, and add your own.
import { useState, type RefObject } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { ColumnDef } from '../shared/types'
import { newId } from '../shared/defaults'
import { setColumns } from '../commands/shots'
import { useStore } from '../store/store'
import { Popover } from './Popover'

const KINDS: { id: ColumnDef['kind']; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'longtext', label: 'Long text' },
  { id: 'number', label: 'Number' },
  { id: 'select', label: 'Choice list' }
]

export function ColumnsMenu({ anchor, onClose }: { anchor: RefObject<HTMLElement | null>; onClose(): void }) {
  const columns = useStore((s) => s.project.shotColumns)
  const run = useStore((s) => s.run)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ColumnDef['kind']>('text')
  const [options, setOptions] = useState('')

  const change = (next: ColumnDef[], label: string) => run(setColumns(columns, next, label))

  const move = (i: number, d: -1 | 1) => {
    const next = [...columns]
    const [c] = next.splice(i, 1)
    next.splice(i + d, 0, c)
    change(next, `Move column ${c.label}`)
  }

  const add = () => {
    const label = name.trim()
    if (!label) return
    const col: ColumnDef = { id: `c_${newId()}`, label, kind, visible: true }
    if (kind === 'select') {
      col.options = options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    }
    change([...columns, col], `Add column ${label}`)
    setName('')
    setOptions('')
  }

  return (
    <Popover anchor={anchor} onClose={onClose} align="right" className="columns-menu">
      <div className="menu-title">Columns</div>
      {columns.map((c, i) => (
        <div key={c.id} className="col-row">
          <label className="check">
            <input
              type="checkbox"
              checked={c.visible}
              disabled={c.id === 'number'}
              onChange={() => change(columns.map((x) => (x.id === c.id ? { ...x, visible: !x.visible } : x)), `${c.visible ? 'Hide' : 'Show'} ${c.label}`)}
            />
            <span>{c.label === '#' ? 'Number' : c.label === 'Frame' ? 'Frame (thumbnail)' : c.label}</span>
          </label>
          {c.kind !== 'builtin' && <span className="col-kind">{KINDS.find((k) => k.id === c.kind)?.label}</span>}
          <span className="spacer" />
          <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
            <ArrowUp size={12} />
          </button>
          <button className="icon-btn" disabled={i === columns.length - 1} onClick={() => move(i, 1)} title="Move down">
            <ArrowDown size={12} />
          </button>
          <button
            className="icon-btn"
            disabled={c.kind === 'builtin'}
            title={c.kind === 'builtin' ? 'Built-in columns can be hidden, not deleted' : 'Delete column'}
            onClick={() => change(columns.filter((x) => x.id !== c.id), `Delete column ${c.label}`)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div className="menu-sep" />
      <div className="menu-title">Add a column</div>
      <div className="add-col">
        <input
          className="text-input"
          placeholder="Name, e.g. Location"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as ColumnDef['kind'])}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        {kind === 'select' && (
          <input className="text-input" placeholder="Choices, comma separated" value={options} onChange={(e) => setOptions(e.target.value)} />
        )}
        <button className="btn primary" onClick={add} disabled={!name.trim()}>
          <Plus size={13} /> Add column
        </button>
      </div>
    </Popover>
  )
}
