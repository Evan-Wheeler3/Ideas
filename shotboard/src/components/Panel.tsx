import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <span>{title}</span>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

// Which sections are collapsed, remembered across sessions (per section title).
const STORAGE_KEY = 'shotboard.collapsed'
function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
const collapsed = loadCollapsed()

/** A titled group of properties. Click the title to fold it away. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  // "Shot 3" and "Shot 4" share one memory: key on the first word.
  const key = title.split(' ')[0]
  const [open, setOpen] = useState(!collapsed.has(key))
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) collapsed.delete(key)
    else collapsed.add(key)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
    } catch {
      // Storage unavailable: the choice just won't be remembered.
    }
  }
  return (
    <div className={`section${open ? '' : ' folded'}`}>
      <button className="section-title" onClick={toggle} aria-expanded={open}>
        <ChevronDown size={12} className="section-chevron" />
        {title}
      </button>
      {open && children}
    </div>
  )
}
