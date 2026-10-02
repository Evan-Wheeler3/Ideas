import type { ObjectKind } from '../shared/types'
import { addNew } from '../store/actions'
import { Panel } from './Panel'
import { KIND_ICONS } from './ScenePanel'

const ITEMS: { kind: ObjectKind; label: string }[] = [
  { kind: 'box', label: 'Box' },
  { kind: 'sphere', label: 'Sphere' },
  { kind: 'cylinder', label: 'Cylinder' },
  { kind: 'cone', label: 'Cone' },
  { kind: 'plane', label: 'Plane' }
]

export function AddPanel() {
  return (
    <Panel title="Add">
      <div className="add-grid">
        {ITEMS.map(({ kind, label }) => {
          const Icon = KIND_ICONS[kind]
          return (
            <button key={kind} className="add-tile" onClick={() => addNew(kind)} title={`Add ${label.toLowerCase()}`}>
              <Icon size={22} strokeWidth={1.4} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
