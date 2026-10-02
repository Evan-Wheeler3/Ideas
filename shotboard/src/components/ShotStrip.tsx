import { useStore } from '../store/store'
import { Panel } from './Panel'

/** Milestone 1 shows the single working shot. The full shot list arrives in milestone 3. */
export function ShotStrip() {
  const shots = useStore((s) => s.project.shots)
  const activeId = useStore((s) => s.activeShotId)

  return (
    <Panel title="Shots">
      <div className="shot-strip">
        {shots.map((s) => (
          <div key={s.id} className={`shot-card${s.id === activeId ? ' active' : ''}`}>
            <div className="shot-thumb" />
            <div className="shot-meta">
              <span className="shot-number">{s.number}</span>
              <span className="shot-type">{s.type}</span>
              <span className="dim mono">{s.camera.focalLength}mm</span>
              <span className="dim mono">{s.duration.toFixed(1)}s</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
