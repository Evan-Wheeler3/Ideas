import { useRef, useState } from 'react'

interface Props {
  value: string
  onCommit(value: string): void
  placeholder?: string
  multiline?: boolean
  className?: string
  title?: string
}

/**
 * A text field that commits on Enter / blur and reverts on Escape.
 * While not focused it always shows `value`, so undo and other edits show up immediately.
 */
export function EditableText({ value, onCommit, placeholder, multiline, className, title }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  const begin = () => {
    cancelled.current = false
    setDraft((d) => d ?? value)
  }
  const finish = () => {
    if (draft !== null && !cancelled.current && draft !== value) onCommit(draft)
    setDraft(null)
  }
  const cancel = (el: HTMLElement) => {
    cancelled.current = true
    el.blur()
  }

  const common = {
    className: `editable ${className ?? ''}`,
    value: draft ?? value,
    placeholder,
    title,
    onFocus: begin,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: finish
  }

  return multiline ? (
    <textarea
      {...common}
      rows={3}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel(e.currentTarget)
        // Ctrl/Cmd+Enter commits; plain Enter adds a line.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur()
      }}
    />
  ) : (
    <input
      {...common}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel(e.currentTarget)
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
