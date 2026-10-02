import type { ReactNode } from 'react'
import { Crosshair, RotateCcw, ScanEye, Video } from 'lucide-react'
import type { Camera, JointName, PosePreset, SceneObject, SensorId, Vec3 } from '../shared/types'
import { updateObject, type ObjectPatch } from '../commands/objects'
import { updateCamera } from '../commands/project'
import { APERTURE_PRESETS, FOCAL_PRESETS, SENSORS, depthOfField, fieldOfView, formatDistance } from '../camera/lens'
import { JOINT_LABELS, POSE_LABELS, clonePose } from '../shared/poses'
import { cameraFromView, focusOn } from '../store/actions'
import { CustomFieldInput, TypeSelect, setShotDuration, setShotNotes } from './shotFields'
import { EditableText } from './EditableText'
import { CAMERA_ID, useActiveShot, useSelectedObjects, useStore } from '../store/store'
import { CAMERA_COLOR } from '../scene/colors'
import { NumberField } from './NumberField'
import { Panel, Section } from './Panel'
import { CameraIcon, iconFor } from './icons'

const AXES = [
  { label: 'X', color: '#e5484d' },
  { label: 'Y', color: '#46a758' },
  { label: 'Z', color: '#3e63dd' }
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function Vec3Row({
  label,
  value,
  step,
  precision,
  suffix,
  labels,
  onChange
}: {
  label: string
  value: Vec3
  step: number
  precision: number
  suffix?: string
  labels?: [string, string, string]
  onChange(v: Vec3): void
}) {
  return (
    <Row label={label}>
      <div className="vec3">
        {AXES.map((axis, i) => (
          <NumberField
            key={axis.label}
            label={labels?.[i] ?? axis.label}
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
    </Row>
  )
}

function Chips<T extends string | number>({
  options,
  value,
  format,
  onPick
}: {
  options: T[]
  value: T | null
  format?(v: T): string
  onPick(v: T): void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} className={`chip${o === value ? ' on' : ''}`} onClick={() => onPick(o)}>
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="switch-track">
        <span className="switch-knob" />
      </span>
      {label}
    </button>
  )
}

/* ---------------- Camera ---------------- */

function CameraProperties() {
  const shot = useActiveShot()
  const aspect = useStore((s) => s.project.settings.aspect)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const run = useStore((s) => s.run)
  const cam = shot.camera
  const fov = fieldOfView(cam.focalLength, cam.sensor, aspect)
  const dof = depthOfField(cam)
  const focusTargets = shot.scene.objects.filter((o) => o.kind !== 'plane')

  const edit = (after: Partial<Camera>, label: string, mergeable = true) => {
    const before = Object.fromEntries(Object.keys(after).map((k) => [k, cam[k as keyof Camera]])) as Partial<Camera>
    run(updateCamera(shot.id, before, after, label, mergeable))
  }

  return (
    <>
      <div className="props-head">
        <CameraIcon size={16} style={{ color: CAMERA_COLOR }} />
        <span>Shot camera</span>
      </div>
      <div className="button-row">
        <button className="btn" onClick={() => setViewMode(viewMode === 'camera' ? 'editor' : 'camera')} title="C">
          <Video size={14} /> {viewMode === 'camera' ? 'Back to editor' : 'Look through'}
        </button>
        <button className="btn" onClick={cameraFromView} disabled={viewMode === 'camera'} title="Move the shot camera to where you're looking from in the editor">
          <ScanEye size={14} /> Camera from view
        </button>
      </div>

      <Section title="Lens">
        <Row label="Focal">
          <NumberField label="mm" value={cam.focalLength} step={1} precision={0} min={8} max={600} onChange={(v) => edit({ focalLength: v }, 'Change focal length')} />
        </Row>
        <Chips options={FOCAL_PRESETS} value={Math.round(cam.focalLength)} format={(v) => `${v}`} onPick={(v) => edit({ focalLength: v }, 'Change focal length', false)} />
        <Row label="Sensor">
          <select className="select" value={cam.sensor} onChange={(e) => edit({ sensor: e.target.value as SensorId }, 'Change sensor', false)}>
            {Object.values(SENSORS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Row>
        <div className="hint-small">
          Sensor {SENSORS[cam.sensor].width} × {SENSORS[cam.sensor].height} mm
        </div>
        <div className="readout">
          <span>Field of view</span>
          <strong>
            {fov.h.toFixed(1)}° × {fov.v.toFixed(1)}°
          </strong>
        </div>
      </Section>

      <Section title="Focus">
        <Row label="Distance">
          <NumberField label="m" value={cam.focusDistance} step={0.02} precision={2} min={0.1} max={1000} onChange={(v) => edit({ focusDistance: v }, 'Pull focus')} />
        </Row>
        <Row label="Focus on">
          <div className="inline">
            <select
              className="select"
              value=""
              onChange={(e) => e.target.value && focusOn(e.target.value)}
              title="Set focus distance to an object"
            >
              <option value="">Pick a subject…</option>
              {focusTargets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </Row>
        <Row label="Aperture">
          <NumberField label="f/" value={cam.aperture} step={0.1} precision={1} min={0.7} max={32} onChange={(v) => edit({ aperture: v }, 'Change aperture')} />
        </Row>
        <Chips options={APERTURE_PRESETS} value={cam.aperture} onPick={(v) => edit({ aperture: v }, 'Change aperture', false)} />
        <div className="switch-row">
          <Switch on={cam.dof} onChange={(v) => edit({ dof: v }, 'Toggle depth of field', false)} label="Show depth of field" />
        </div>
        <div className="readout">
          <span>In focus</span>
          <strong>
            {formatDistance(dof.near)} – {formatDistance(dof.far)}
          </strong>
        </div>
      </Section>

      <Section title="Position">
        <Vec3Row label="Position" value={cam.position} step={0.05} precision={2} onChange={(v) => edit({ position: v }, 'Move camera')} />
        <Vec3Row
          label="Angle"
          labels={['T', 'P', 'R']}
          value={cam.rotation}
          step={0.5}
          precision={1}
          suffix="°"
          onChange={(v) => edit({ rotation: v }, 'Rotate camera')}
        />
        <div className="hint-small">Angle: tilt, pan, roll. Height above floor: {cam.position[1].toFixed(2)} m</div>
      </Section>
    </>
  )
}

/* ---------------- Shot ---------------- */

function ShotProperties() {
  const shot = useActiveShot()
  const columns = useStore((s) => s.project.shotColumns).filter((c) => c.kind !== 'builtin' && c.visible)
  return (
    <Section title={`Shot ${shot.number}`}>
      <Row label="Type">
        <TypeSelect shot={shot} />
      </Row>
      <Row label="Duration">
        <NumberField label="s" value={shot.duration} step={0.1} precision={1} min={0.1} max={600} onChange={(v) => setShotDuration(shot, v)} />
      </Row>
      <div className="prop-stack">
        <div className="prop-label">Notes</div>
        <EditableText multiline value={shot.notes} placeholder="Action, dialogue, intent…" onCommit={(t) => setShotNotes(shot, t)} />
      </div>
      {columns.map((c) => (
        <Row key={c.id} label={c.label}>
          <CustomFieldInput shot={shot} col={c} />
        </Row>
      ))}
    </Section>
  )
}

/* ---------------- Objects ---------------- */

function PersonProperties({ obj, edit }: { obj: SceneObject; edit(after: ObjectPatch, label: string, mergeable?: boolean): void }) {
  const selectJoint = useStore((s) => s.selectJoint)
  const presets = Object.keys(POSE_LABELS) as PosePreset[]
  const current = obj.pose?.preset ?? 'stand'
  return (
    <Section title="Pose">
      <Chips
        options={presets}
        value={current === 'custom' ? null : current}
        format={(p) => POSE_LABELS[p]}
        onPick={(p) => edit({ pose: clonePose(p) }, `Pose ${obj.name}: ${POSE_LABELS[p]}`, false)}
      />
      {current === 'custom' && <div className="hint-small">Custom pose. Pick a preset to start over.</div>}
      <Row label="Height">
        <NumberField
          label="m"
          value={1.75 * obj.scale[1]}
          step={0.01}
          precision={2}
          min={0.5}
          max={2.5}
          onChange={(h) => {
            const k = h / 1.75
            edit({ scale: [k, k, k] }, `Resize ${obj.name}`)
          }}
        />
      </Row>
      <div className="joint-list">
        {(Object.keys(JOINT_LABELS) as JointName[]).map((j) => (
          <button key={j} className="joint-btn" onClick={() => selectJoint(obj.id, j)}>
            {JOINT_LABELS[j]}
          </button>
        ))}
      </div>
    </Section>
  )
}

function JointProperties({ obj, joint }: { obj: SceneObject; joint: JointName }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)
  const selectJoint = useStore((s) => s.selectJoint)
  const pose = obj.pose!
  const value: Vec3 = pose.joints[joint] ?? [0, 0, 0]
  const setJoint = (v: Vec3, mergeable = true) => {
    const after = { ...pose, preset: 'custom' as const, joints: { ...pose.joints, [joint]: v } }
    run(updateObject(shot.id, obj.id, { pose }, { pose: after }, `Pose ${obj.name}`, mergeable))
  }
  return (
    <>
      <div className="props-head">
        <span className="props-dot" style={{ background: obj.color }} />
        <span>
          {obj.name} · {JOINT_LABELS[joint]}
        </span>
      </div>
      <Section title="Joint">
        <Vec3Row label="Bend" value={value} step={1} precision={0} suffix="°" onChange={(v) => setJoint(v)} />
        <div className="button-row">
          <button className="btn" onClick={() => setJoint([0, 0, 0], false)}>
            <RotateCcw size={13} /> Straighten
          </button>
          <button className="btn" onClick={() => selectJoint(obj.id, null)}>
            Done (Esc)
          </button>
        </div>
        <div className="hint-small">Drag the rings in the 3D view, or drag the X/Y/Z labels here.</div>
      </Section>
    </>
  )
}

function ObjectProperties({ obj }: { obj: SceneObject }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)
  const Icon = iconFor(obj)

  const edit = (after: ObjectPatch, label: string, mergeable = true) => {
    const before = Object.fromEntries(Object.keys(after).map((k) => [k, obj[k as keyof SceneObject]])) as ObjectPatch
    run(updateObject(shot.id, obj.id, before, after, label, mergeable))
  }

  return (
    <>
      <div className="props-head">
        <Icon size={16} />
        <input
          className="props-name"
          key={obj.id + obj.name}
          defaultValue={obj.name}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== obj.name) edit({ name: v }, `Rename ${obj.name}`, false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <Section title="Look">
        <Row label="Color">
          <div className="color-row">
            <input type="color" value={obj.color} onChange={(e) => edit({ color: e.target.value }, `Color ${obj.name}`)} />
            <span className="mono dim">{obj.color.toUpperCase()}</span>
          </div>
        </Row>
      </Section>
      {obj.kind === 'mannequin' && <PersonProperties obj={obj} edit={edit} />}
      <Section title="Transform">
        <Vec3Row label="Position" value={obj.position} step={0.05} precision={2} onChange={(v) => edit({ position: v }, `Move ${obj.name}`)} />
        <Vec3Row label="Rotation" value={obj.rotation} step={1} precision={1} suffix="°" onChange={(v) => edit({ rotation: v }, `Rotate ${obj.name}`)} />
        {obj.kind !== 'mannequin' && (
          <Vec3Row label="Scale" value={obj.scale} step={0.02} precision={2} onChange={(v) => edit({ scale: v }, `Scale ${obj.name}`)} />
        )}
        <div className="button-row">
          <button className="btn" onClick={() => focusOn(obj.id)} title="Set the camera's focus distance to this object">
            <Crosshair size={13} /> Focus camera here
          </button>
          <button className="btn" onClick={() => focusOn(obj.id, true)} title="Turn the camera to look at this object">
            Aim camera
          </button>
        </div>
      </Section>
    </>
  )
}

export function PropertiesPanel() {
  const selected = useSelectedObjects()
  const selection = useStore((s) => s.selection)
  const joint = useStore((s) => s.joint)
  const primary = selected[selected.length - 1]
  const showCamera = selection[selection.length - 1] === CAMERA_ID || selection.length === 0

  return (
    <Panel title="Properties">
      {selection.length === 0 && <ShotProperties />}
      {showCamera && <CameraProperties />}
      {!showCamera && primary && selected.length > 1 && (
        <div className="hint">{selected.length} objects selected. Editing {primary.name}.</div>
      )}
      {!showCamera && primary && joint?.objectId === primary.id && primary.pose ? (
        <JointProperties obj={primary} joint={joint.joint} />
      ) : (
        !showCamera && primary && <ObjectProperties key={primary.id} obj={primary} />
      )}
    </Panel>
  )
}
