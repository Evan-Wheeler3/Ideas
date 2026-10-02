import type { ReactNode } from 'react'

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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}
