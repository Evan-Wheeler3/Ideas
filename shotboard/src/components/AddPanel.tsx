import { useRef } from 'react'
import { Package, Upload } from 'lucide-react'
import { CATALOG, CATEGORY_LABELS, type CatalogCategory } from '../shared/catalog'
import { addFromCatalog, addImported, importModelFiles } from '../store/actions'
import { useStore } from '../store/store'
import { Panel } from './Panel'
import { CATALOG_ICONS } from './icons'

const ORDER: CatalogCategory[] = ['people', 'furniture', 'set', 'shapes']

export function AddPanel() {
  const fileInput = useRef<HTMLInputElement>(null)
  const assets = useStore((s) => s.project.assets)
  const imported = Object.values(assets)

  return (
    <Panel
      title="Add"
      actions={
        <button className="panel-btn" onClick={() => fileInput.current?.click()} title="Import a .glb or .gltf model (or drop it on the 3D view)">
          <Upload size={13} /> Import
        </button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf"
        multiple
        hidden
        onChange={(e) => {
          void importModelFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {ORDER.map((cat) => (
        <div key={cat} className="add-section">
          <div className="add-section-title">{CATEGORY_LABELS[cat]}</div>
          <div className="add-grid">
            {CATALOG.filter((c) => c.category === cat).map((item) => {
              const Icon = CATALOG_ICONS[item.key] ?? Package
              return (
                <button key={item.key} className="add-tile" onClick={() => addFromCatalog(item.key)} title={`Add ${item.label.toLowerCase()}`}>
                  <Icon size={20} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {imported.length > 0 && (
        <div className="add-section">
          <div className="add-section-title">Imported</div>
          <div className="add-grid">
            {imported.map((a) => (
              <button key={a.id} className="add-tile" onClick={() => addImported(a.id)} title={`Add another ${a.name}`}>
                <Package size={20} strokeWidth={1.5} />
                <span className="add-tile-name">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
