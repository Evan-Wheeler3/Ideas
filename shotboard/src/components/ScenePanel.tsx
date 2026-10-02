import { useState } from 'react'
import { Box, Circle, Cone, Cylinder, Eye, EyeOff, Lightbulb, Package, Square, User } from 'lucide-react'
import type { ObjectKind, SceneObject } from '../shared/types'
import { updateObject } from '../commands/objects'
import { useActiveShot, useStore } from '../store/store'
import { Panel } from './Panel'

export const KIND_ICONS: Record<ObjectKind, typeof Box> = {
  box: Box,
  sphere: Circle,
  cylinder: Cylinder,
  cone: Cone,
  plane: Square,
  mannequin: User,
  model: Package,
  light: Lightbulb
}

function Row({ obj, selected }: { obj: SceneObject; selected: boolean }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)
  const select = useStore((s) => s.select)
  const toggleSelect = useStore((s) => s.toggleSelect)
  const [renaming, setRenaming] = useState(false)
  const Icon = KIND_ICONS[obj.kind]

  const rename = (name: string) => {
    setRenaming(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== obj.name) run(updateObject(shot.id, obj.id, { name: obj.name }, { name: trimmed }, `Rename ${obj.name}`, false))
  }

  return (
    <div
      className={`tree-row${selected ? ' selected' : ''}${obj.visible ? '' : ' hidden-obj'}`}
      onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey ? toggleSelect(obj.id) : select([obj.id]))}
      onDoubleClick={() => setRenaming(true)}
    >
      <Icon size={14} className="tree-icon" />
      {renaming ? (
        <input
          className="tree-rename"
          autoFocus
          defaultValue={obj.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') rename((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setRenaming(false)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="tree-name">{obj.name}</span>
      )}
      <button
        className="icon-btn ghost"
        title={obj.visible ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation()
          run(
            updateObject(shot.id, obj.id, { visible: obj.visible }, { visible: !obj.visible }, `${obj.visible ? 'Hide' : 'Show'} ${obj.name}`, false)
          )
        }}
      >
        {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    </div>
  )
}

export function ScenePanel() {
  const shot = useActiveShot()
  const selection = useStore((s) => s.selection)

  return (
    <Panel title="Scene">
      {shot.scene.objects.length === 0 && <div className="empty">Nothing here yet. Add something below.</div>}
      <div className="tree">
        {shot.scene.objects.map((o) => (
          <Row key={o.id} obj={o} selected={selection.includes(o.id)} />
        ))}
      </div>
    </Panel>
  )
}
