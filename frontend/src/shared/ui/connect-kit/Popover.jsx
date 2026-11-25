import { useEffect, useRef } from 'react'

/**
 * Anchored panel opening above (`side="top"`) or below its trigger. Closes on outside click and on
 * Escape (focus goes back to the trigger); the first focusable item gets focus.
 * `trigger` renders the button and receives `{ open, toggle }`.
 */
export default function Popover({ open, onOpenChange, trigger, children, align = 'start', side = 'top', label, className = '' }) {
  const rootRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const root = rootRef.current
    panelRef.current?.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus()
    const onPointer = (event) => {
      if (!root?.contains(event.target)) onOpenChange(false)
    }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      onOpenChange(false)
      root?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onOpenChange, open])

  return (
    <div ref={rootRef} className="pc-popover">
      {trigger({ open, toggle: () => onOpenChange(!open) })}
      {open && (
        <div ref={panelRef} role="dialog" aria-label={label} className={`pc-popover__panel pc-popover__panel--${align} pc-popover__panel--${side} ${className}`.trim()}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Vertical list of 36px actions for a Popover; `onSelect(item)` then closes. */
export function MenuList({ items, onSelect }) {
  return (
    <div role="menu" className="pc-menu">
      {items.map((item) => (
        <button key={item.key} type="button" role="menuitem" disabled={item.disabled} onClick={() => onSelect(item)} className="pc-menu__item">
          <span className="pc-menu__icon" aria-hidden>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
