import { useEffect, useId, useRef } from 'react'

/**
 * Native modal `<dialog>`: Escape and a click on the backdrop call `onClose`.
 * `footer` sits right-aligned under the body. Falls back to the `open`
 * attribute where `showModal` is missing (tests, old browsers).
 */
export default function Dialog({ open, title, onClose, footer, children, className = '' }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal()
      else element.setAttribute('open', '')
    } else if (!open && element.open) {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`pc-dialog ${className}`.trim()}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="pc-dialog__inner">
          <h2 id={titleId} className="pc-dialog__title">{title}</h2>
          <div className="pc-dialog__body">{children}</div>
          {footer && <div className="pc-dialog__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
