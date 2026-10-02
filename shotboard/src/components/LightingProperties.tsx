// Properties for the shot's lighting (presets, environment) and for a selected light.
import { Copy } from 'lucide-react'
import type { EnvironmentPreset, LightSettings, SceneObject, Vec3 } from '../shared/types'
import { updateObject } from '../commands/objects'
import { ENVIRONMENTS } from '../scene/environments'
import { LIGHTING_PRESETS } from '../scene/lightingPresets'
import { KELVIN_PRESETS, lightColor } from '../scene/kelvin'
import { applyLightingPreset, applyLookToAllShots, changeEnvironment, setEnvironmentPreset } from '../store/lookActions'
import { useActiveShot, useStore } from '../store/store'
import { NumberField } from './NumberField'
import { Section } from './Panel'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div>{children}</div>
    </div>
  )
}

export function LightingProperties() {
  const shot = useActiveShot()
  const shotCount = useStore((s) => s.project.shots.length)
  const env = shot.scene.environment
  const preset = shot.scene.lightingPreset

  return (
    <Section title="Lighting">
      <div className="chips">
        {LIGHTING_PRESETS.map((p) => (
          <button key={p.id} className={`chip wide${preset === p.id ? ' on' : ''}`} title={p.hint} onClick={() => applyLightingPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <Row label="Setting">
        <select className="select" value={env.preset} onChange={(e) => setEnvironmentPreset(e.target.value as EnvironmentPreset)}>
          {(Object.keys(ENVIRONMENTS) as EnvironmentPreset[]).map((k) => (
            <option key={k} value={k}>
              {ENVIRONMENTS[k].label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Background">
        <div className="inline">
          <div className="seg-small text">
            <button className={env.background === 'sky' ? 'on' : ''} onClick={() => changeEnvironment({ background: 'sky' }, 'Sky background')}>
              Sky
            </button>
            <button className={env.background === 'color' ? 'on' : ''} onClick={() => changeEnvironment({ background: 'color' }, 'Flat background')}>
              Flat
            </button>
          </div>
          {env.background === 'color' && (
            <div className="color-row">
              <input type="color" value={env.color} onChange={(e) => changeEnvironment({ color: e.target.value }, 'Background colour', true)} />
            </div>
          )}
        </div>
      </Row>
      <Row label="Exposure">
        <NumberField label="EV" value={env.exposure ?? 0} step={0.05} precision={1} min={-4} max={4} onChange={(v) => changeEnvironment({ exposure: v }, 'Exposure', true)} />
      </Row>
      {shotCount > 1 && (
        <div className="button-row">
          <button className="btn" onClick={applyLookToAllShots} title="Give every shot this shot's setting, background, exposure and lights">
            <Copy size={13} /> Use this lighting in all shots
          </button>
        </div>
      )}
    </Section>
  )
}

export function LightProperties({ obj }: { obj: SceneObject }) {
  const shot = useActiveShot()
  const run = useStore((s) => s.run)
  const l = obj.light!
  const swatch = `#${lightColor(l.kelvin, l.color).getHexString()}`

  const set = (patch: Partial<LightSettings>, label: string, mergeable = true) =>
    run(updateObject(shot.id, obj.id, { light: l }, { light: { ...l, ...patch } }, `${label} ${obj.name}`, mergeable))
  const setSize = (i: 0 | 1, v: number) => {
    const scale = [...obj.scale] as Vec3
    scale[i] = v
    run(updateObject(shot.id, obj.id, { scale: obj.scale }, { scale }, `Resize ${obj.name}`))
  }

  return (
    <Section title="Light">
      <Row label="Type">
        <select className="select" value={l.type} onChange={(e) => set({ type: e.target.value as LightSettings['type'] }, 'Change type of', false)}>
          <option value="spot">Spot</option>
          <option value="area">Soft panel</option>
          <option value="point">Practical (bulb)</option>
          <option value="directional">Sun</option>
        </select>
      </Row>
      <Row label="Brightness">
        <NumberField label="" value={l.intensity} step={0.05} precision={1} min={0} max={10} onChange={(v) => set({ intensity: v }, 'Brightness')} />
      </Row>
      <Row label="Colour temp">
        <div className="inline">
          <span className="kelvin-swatch" style={{ background: swatch }} />
          <NumberField label="K" value={l.kelvin} step={20} precision={0} min={1000} max={12000} onChange={(v) => set({ kelvin: v }, 'Colour temperature')} />
        </div>
      </Row>
      <div className="chips">
        {KELVIN_PRESETS.map((k) => (
          <button key={k.label} className={`chip wide${l.kelvin === k.kelvin ? ' on' : ''}`} onClick={() => set({ kelvin: k.kelvin }, 'Colour temperature', false)}>
            {k.label}
          </button>
        ))}
      </div>
      <Row label="Gel / tint">
        <div className="color-row">
          <input type="color" value={l.color} onChange={(e) => set({ color: e.target.value }, 'Tint')} />
          <span className="mono dim">{l.color.toUpperCase()}</span>
        </div>
      </Row>
      {l.type === 'spot' && (
        <Row label="Beam">
          <NumberField label="°" value={l.angle ?? 35} step={0.5} precision={0} min={5} max={120} onChange={(v) => set({ angle: v }, 'Beam angle')} />
        </Row>
      )}
      {l.type === 'area' && (
        <Row label="Size">
          <div className="vec3 two">
            <NumberField label="W" value={obj.scale[0]} step={0.02} precision={2} min={0.1} max={10} onChange={(v) => setSize(0, v)} />
            <NumberField label="H" value={obj.scale[1]} step={0.02} precision={2} min={0.1} max={10} onChange={(v) => setSize(1, v)} />
          </div>
        </Row>
      )}
      {l.type !== 'area' && (
        <label className="check shadows-check">
          <input type="checkbox" checked={l.shadows} onChange={() => set({ shadows: !l.shadows }, l.shadows ? 'Shadows off for' : 'Shadows on for', false)} />
          <span>Casts shadows</span>
        </label>
      )}
      <div className="hint-small">Lights shine the way they point: rotate with E, or move them and use the arrow to aim.</div>
    </Section>
  )
}
