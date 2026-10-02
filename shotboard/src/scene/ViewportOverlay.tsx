// 2D layer over the 3D view: the view toolbar, and in camera view the frame masks,
// composition guides and the lens readout. Drawn in HTML/SVG so lines stay crisp.
import { Aperture, Box, Grid3x3, Crosshair, Ratio, Tag, Video, ScanLine } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AspectRatio } from '../shared/types'
import type { Rect } from '../camera/gate'
import { ASPECTS, SENSORS, depthOfField, fieldOfView, formatDistance } from '../camera/lens'
import { updateCamera, updateSettings } from '../commands/project'
import { CAMERA_ID, useActiveShot, useStore } from '../store/store'

function Toggle({ on, onClick, title, children }: { on: boolean; onClick(): void; title: string; children: ReactNode }) {
  return (
    <button className={`ov-btn${on ? ' on' : ''}`} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

function Guides({ gate }: { gate: Rect }) {
  const guides = useStore((s) => s.guides)
  const { x, y, width: w, height: h } = gate
  const safe = (pct: number) => {
    const m = (1 - pct) / 2
    return <rect x={x + w * m} y={y + h * m} width={w * pct} height={h * pct} />
  }
  return (
    <svg className="ov-guides" width="100%" height="100%">
      <g className="ov-mask" style={{ opacity: guides.mask }}>
        <rect x={0} y={0} width="100%" height={y} />
        <rect x={0} y={y + h} width="100%" height="100%" />
        <rect x={0} y={y} width={x} height={h} />
        <rect x={x + w} y={y} width="100%" height={h} />
      </g>
      <rect className="ov-frame" x={x} y={y} width={w} height={h} />
      {guides.thirds && (
        <g className="ov-line">
          {[1, 2].map((i) => (
            <g key={i}>
              <line x1={x + (w * i) / 3} y1={y} x2={x + (w * i) / 3} y2={y + h} />
              <line x1={x} y1={y + (h * i) / 3} x2={x + w} y2={y + (h * i) / 3} />
            </g>
          ))}
        </g>
      )}
      {guides.safe && (
        <g className="ov-safe">
          {safe(0.93)}
          {safe(0.9)}
        </g>
      )}
      {guides.center && (
        <g className="ov-line strong">
          <line x1={x + w / 2 - 14} y1={y + h / 2} x2={x + w / 2 + 14} y2={y + h / 2} />
          <line x1={x + w / 2} y1={y + h / 2 - 14} x2={x + w / 2} y2={y + h / 2 + 14} />
        </g>
      )}
    </svg>
  )
}

function CameraHud({ gate }: { gate: Rect }) {
  const shot = useActiveShot()
  const aspect = useStore((s) => s.project.settings.aspect)
  const cam = shot.camera
  const fov = fieldOfView(cam.focalLength, cam.sensor, aspect)
  const dof = depthOfField(cam)
  return (
    <div className="ov-hud" style={{ left: gate.x, width: gate.width, top: gate.y + gate.height + 7 }}>
      <span className="hud-shot">
        SHOT {shot.number} <em>{shot.type}</em>
      </span>
      <span className="hud-strong">{Math.round(cam.focalLength)}mm</span>
      <span>f/{cam.aperture}</span>
      <span>Focus {formatDistance(cam.focusDistance)}</span>
      {cam.dof && (
        <span className="dim">
          Sharp {formatDistance(dof.near)}–{formatDistance(dof.far)}
        </span>
      )}
      <span className="spacer" />
      <span className="dim">{SENSORS[cam.sensor].label}</span>
      <span className="dim">{fov.h.toFixed(1)}° H</span>
      <span className="dim">{ASPECTS.find((a) => a.id === aspect)?.label}</span>
    </div>
  )
}

export function ViewportOverlay({ gate }: { gate: Rect }) {
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const guides = useStore((s) => s.guides)
  const setGuides = useStore((s) => s.setGuides)
  const showLabels = useStore((s) => s.showLabels)
  const toggleLabels = useStore((s) => s.toggleLabels)
  const aspect = useStore((s) => s.project.settings.aspect)
  const run = useStore((s) => s.run)
  const select = useStore((s) => s.select)
  const joint = useStore((s) => s.joint)
  const selection = useStore((s) => s.selection)
  const shot = useActiveShot()
  const inCamera = viewMode === 'camera'
  const selectedPerson = shot.scene.objects.find((o) => o.id === selection[selection.length - 1] && o.kind === 'mannequin')

  return (
    <div className="viewport-overlay">
      {inCamera && <Guides gate={gate} />}
      {inCamera && <CameraHud gate={gate} />}

      <div className="ov-toolbar">
        <div className="ov-group">
          <Toggle on={!inCamera} onClick={() => setViewMode('editor')} title="Editor view (C)">
            <Box size={14} /> Editor
          </Toggle>
          <Toggle on={inCamera} onClick={() => setViewMode('camera')} title="Look through the shot camera (C)">
            <Video size={14} /> Camera
          </Toggle>
        </div>

        {inCamera ? (
          <>
            <div className="ov-group">
              <Ratio size={14} className="ov-icon" />
              <select
                className="ov-select"
                value={aspect}
                title="Frame aspect ratio"
                onChange={(e) =>
                  run(updateSettings({ aspect }, { aspect: e.target.value as AspectRatio }, 'Change aspect ratio'))
                }
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ov-group">
              <Toggle on={guides.thirds} onClick={() => setGuides({ thirds: !guides.thirds })} title="Rule of thirds (G)">
                <Grid3x3 size={14} />
              </Toggle>
              <Toggle on={guides.safe} onClick={() => setGuides({ safe: !guides.safe })} title="Action and title safe areas">
                <ScanLine size={14} />
              </Toggle>
              <Toggle on={guides.center} onClick={() => setGuides({ center: !guides.center })} title="Center mark">
                <Crosshair size={14} />
              </Toggle>
              <Toggle
                on={shot.camera.dof}
                onClick={() =>
                  run(updateCamera(shot.id, { dof: shot.camera.dof }, { dof: !shot.camera.dof }, 'Toggle depth of field', false))
                }
                title="Depth of field: blur what's out of focus"
              >
                <Aperture size={14} /> DoF
              </Toggle>
            </div>
          </>
        ) : (
          <div className="ov-group">
            <Toggle on={showLabels} onClick={toggleLabels} title="Show name labels (L)">
              <Tag size={14} /> Labels
            </Toggle>
            <Toggle on={selection.includes(CAMERA_ID)} onClick={() => select([CAMERA_ID])} title="Select the shot camera">
              <Video size={14} /> Select camera
            </Toggle>
          </div>
        )}
      </div>

      {inCamera && (
        <div className="ov-tip">Drag to orbit the camera around its focus point · right-drag to pan · scroll to dolly · F aims at the selection</div>
      )}
      {!inCamera && selectedPerson && (
        <div className="ov-tip">
          {joint
            ? 'Drag the rings to bend the joint · click another white dot · Esc to finish'
            : 'Click a white dot on the figure to bend that joint, or pick a pose in Properties'}
        </div>
      )}
    </div>
  )
}
