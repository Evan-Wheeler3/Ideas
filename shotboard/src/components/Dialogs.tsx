// App-wide confirm dialog and toast messages, styled to match the app (no browser popups).
import { useEffect } from 'react'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

interface DialogState {
  confirm: (ConfirmOptions & { resolve(ok: boolean): void }) | null
  toasts: Toast[]
}

const useDialogs = create<DialogState>(() => ({ confirm: null, toasts: [] }))

/** Ask the user to confirm. Resolves true for the confirm button, false for cancel/Escape. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useDialogs.setState({ confirm: { ...opts, resolve } }))
}

let nextToast = 1
export function toast(text: string, kind: Toast['kind'] = 'success'): void {
  const id = nextToast++
  useDialogs.setState((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
  setTimeout(() => useDialogs.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 2800)
}

function ConfirmDialog() {
  const confirm = useDialogs((s) => s.confirm)
  const close = (ok: boolean) => {
    confirm?.resolve(ok)
    useDialogs.setState({ confirm: null })
  }

  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!confirm) return null
  return (
    <div className="modal-backdrop" onMouseDown={() => close(false)}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {confirm.danger ? <AlertTriangle size={16} className="modal-icon danger" /> : <Info size={16} className="modal-icon" />}
          {confirm.title}
        </div>
        <div className="modal-body">{confirm.message}</div>
        <div className="modal-actions">
          <button className="btn" onClick={() => close(false)}>
            {confirm.cancelLabel ?? 'Cancel'}
          </button>
          <button className={`btn primary${confirm.danger ? ' danger' : ''}`} onClick={() => close(true)} autoFocus>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toasts() {
  const toasts = useDialogs((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'success' && <CheckCircle2 size={15} />}
          {t.kind === 'error' && <AlertTriangle size={15} />}
          {t.kind === 'info' && <Info size={15} />}
          <span>{t.text}</span>
          <button className="icon-btn" onClick={() => useDialogs.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function DialogHost() {
  return (
    <>
      <ConfirmDialog />
      <Toasts />
    </>
  )
}
