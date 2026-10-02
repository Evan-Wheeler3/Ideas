import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { SceneObject } from '../shared/types'
import { updateObject } from '../commands/objects'
import { CAMERA_ID, useActiveShot, useStore } from '../store/store'
import { lensLabel } from '../camera/lens'
import { useDisplayCamera } from '../store/cameraActions'
import { CAMERA_COLOR } from '../scene/colors'
import { Panel } from './Panel'
import { CameraIcon, iconFor } from './icons'

type Group = 'People' | 'Props & set' | 'Imported' | 'Shapes'

function groupOf(o: SceneObject): Group {
  if (o.kind === 'mannequin') return 'People'
  if (o.kind === 'prop' || o.kind === 'plane') return 'Props & set'
  if (o.kind === 'model') return 'Imported'
  return 'Shapes'
}

const GROUPS: Group[] = ['People', 'Props & set', 'Imported', 'Shapes']

function Row({ obj, selected }: { obj: SceneObject; selected: boolean }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)
  const select = useStore((s) => s.select)
  const toggleSelect = useStore((s) => s.toggleSelect)
  const hovered = useStore((s) => s.hoveredId === obj.id)
  const setHovered = useStore((s) => s.setHovered)
  const [renaming, setRenaming] = useState(false)
  const Icon = iconFor(obj)

  const rename = (name: string) => {
    setRenaming(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== obj.name) {
      run(updateObject(shot.id, obj.id, { name: obj.name }, { name: trimmed }, `Rename ${obj.name}`, false))
    }
  }

  return (
    <div
      className={`tree-row${selected ? ' selected' : ''}${hovered ? ' hovered' : ''}${obj.visible ? '' : ' hidden-obj'}`}
      onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey ? toggleSelect(obj.id) : select([obj.id]))}
      onDoubleClick={() => setRenaming(true)}
      onMouseEnter={() => setHovered(obj.id)}
      onMouseLeave={() => setHovered(null)}
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
      <span className="tree-swatch" style={{ background: obj.color }} />
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
  const select = useStore((s) => s.select)
  const camSelected = selection.includes(CAMERA_ID)
  const cam = useDisplayCamera()

  return (
    <Panel title="Scene">
      <div className="tree">
        <div className={`tree-row camera-row${camSelected ? ' selected' : ''}`} onClick={() => select([CAMERA_ID])}>
          <CameraIcon size={14} className="tree-icon" style={{ color: CAMERA_COLOR }} />
          <span className="tree-name">Camera</span>
          <span className="tree-meta">{lensLabel(cam)}</span>
        </div>
        {GROUPS.map((g) => {
          const items = shot.scene.objects.filter((o) => groupOf(o) === g)
          if (!items.length) return null
          return (
            <div key={g}>
              <div className="tree-group">
                {g}
                <span>{items.length}</span>
              </div>
              {items.map((o) => (
                <Row key={o.id} obj={o} selected={selection.includes(o.id)} />
              ))}
            </div>
          )
        })}
        {shot.scene.objects.length === 0 && <div className="empty">Nothing here yet. Add people and props from the panel below.</div>}
      </div>
    </Panel>
  )
}
