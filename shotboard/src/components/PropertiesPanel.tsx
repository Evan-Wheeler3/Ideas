import type { SceneObject, Vec3 } from '../shared/types'
import { updateObject, type ObjectPatch } from '../commands/objects'
import { useActiveShot, useSelectedObjects, useStore } from '../store/store'
import { NumberField } from './NumberField'
import { Panel, Section } from './Panel'

const AXES = [
  { label: 'X', color: '#e5484d' },
  { label: 'Y', color: '#46a758' },
  { label: 'Z', color: '#3e63dd' }
]

function Vec3Row({
  label,
  value,
  step,
  precision,
  suffix,
  onChange
}: {
  label: string
  value: Vec3
  step: number
  precision: number
  suffix?: string
  onChange(v: Vec3): void
}) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div className="vec3">
        {AXES.map((axis, i) => (
          <NumberField
            key={axis.label}
            label={axis.label}
            accent={axis.color}
            value={value[i]}
            step={step}
            precision={precision}
            suffix={suffix}
            onChange={(n) => {
              const next = [...value] as Vec3
              next[i] = n
              onChange(next)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ObjectProperties({ obj }: { obj: SceneObject }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)

  const edit = (after: ObjectPatch, label: string) => {
    const before = Object.fromEntries(Object.keys(after).map((k) => [k, obj[k as keyof SceneObject]])) as ObjectPatch
    run(updateObject(shot.id, obj.id, before, after, `${label} ${obj.name}`))
  }

  return (
    <>
      <Section title="Object">
        <div className="prop-row">
          <div className="prop-label">Name</div>
          <input
            className="text-input"
            key={obj.id}
            defaultValue={obj.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== obj.name && edit({ name: e.target.value.trim() }, 'Rename')}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div className="prop-row">
          <div className="prop-label">Color</div>
          <div className="color-row">
            <input type="color" value={obj.color} onChange={(e) => edit({ color: e.target.value }, 'Color')} />
            <span className="mono dim">{obj.color.toUpperCase()}</span>
          </div>
        </div>
      </Section>
      <Section title="Transform">
        <Vec3Row label="Position" value={obj.position} step={0.05} precision={2} onChange={(v) => edit({ position: v }, 'Move')} />
        <Vec3Row label="Rotation" value={obj.rotation} step={1} precision={1} suffix="°" onChange={(v) => edit({ rotation: v }, 'Rotate')} />
        <Vec3Row label="Scale" value={obj.scale} step={0.02} precision={2} onChange={(v) => edit({ scale: v }, 'Scale')} />
      </Section>
    </>
  )
}

export function PropertiesPanel() {
  const selected = useSelectedObjects()
  const primary = selected[selected.length - 1]

  return (
    <Panel title="Properties">
      {!primary && <div className="empty">Select an object in the viewport or the scene list.</div>}
      {primary && selected.length > 1 && (
        <div className="hint">{selected.length} objects selected. Editing {primary.name}.</div>
      )}
      {primary && <ObjectProperties key={primary.id} obj={primary} />}
    </Panel>
  )
}
