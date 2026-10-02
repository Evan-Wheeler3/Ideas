// A floating menu rendered at the top of the page (so panels can't clip or cover it),
// placed next to its anchor: below if there's room, otherwise above. Closes on outside click / Escape.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  anchor: RefObject<HTMLElement | null>
  onClose(): void
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}

export function Popover({ anchor, onClose, align = 'left', className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      const h = el.offsetHeight
      const w = el.offsetWidth
      const below = window.innerHeight - a.bottom - 8
      const above = a.top - 8
      const placeBelow = below >= Math.min(h, 320) || below >= above
      const maxHeight = Math.max(placeBelow ? below : above, 120) - 8
      const top = placeBelow ? a.bottom + 6 : Math.max(a.top - 6 - Math.min(h, maxHeight), 8)
      const left = Math.min(Math.max(align === 'right' ? a.right - w : a.left, 8), window.innerWidth - w - 8)
      setPos({ top, left, maxHeight })
    }
    place()
    // Re-place when the content changes size (e.g. a column was added) so it never covers its button.
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [anchor, align])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      className={`menu ${className ?? ''}`}
      style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { visibility: 'hidden', top: 0, left: 0 }}
    >
      {children}
    </div>,
    document.body
  )
}
