import { CloseOutlined } from '@ant-design/icons'
import { useEffect, useRef } from 'react'
import { IconButton } from './Button'

/** Right sheet (340px) for tablet widths; Escape or the close button dismisses it. */
export default function SidePanel({ open, title, onClose, closeLabel, children }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return undefined
    ref.current?.focus()
    const onKey = (event) => event.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      aria-hidden={!open}
      inert={open ? undefined : true}
      className={`pc-side${open ? ' pc-side--open' : ''}`}
    >
      <header className="pc-side__head">
        <h2 className="pc-side__title">{title}</h2>
        <IconButton label={closeLabel} onClick={onClose}><CloseOutlined /></IconButton>
      </header>
      <div className="pc-side__body">{children}</div>
    </aside>
  )
}
