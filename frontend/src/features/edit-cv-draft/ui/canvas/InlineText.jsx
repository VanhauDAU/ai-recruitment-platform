import { useCallback, useEffect, useRef } from 'react'

export default function InlineText({ value = '', placeholder, ariaLabel, className = '', onCommit, registerPendingEdit }) {
  const rootRef = useRef(null)
  const timerRef = useRef(null)
  const composingRef = useRef(false)
  const pendingRef = useRef(value)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const next = pendingRef.current.trimEnd()
    if (next !== value) onCommit(next)
  }, [onCommit, value])

  useEffect(() => registerPendingEdit?.(flush), [flush, registerPendingEdit])
  useEffect(() => {
    if (globalThis.document.activeElement !== rootRef.current && rootRef.current && rootRef.current.textContent !== value) {
      rootRef.current.textContent = value
      pendingRef.current = value
    }
  }, [value])

  const schedule = () => {
    if (composingRef.current) return
    pendingRef.current = rootRef.current?.textContent || ''
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 400)
  }

  return <span
    ref={rootRef}
    role="textbox"
    aria-label={ariaLabel}
    aria-placeholder={placeholder}
    contentEditable
    suppressContentEditableWarning
    data-placeholder={placeholder}
    className={`inline-block min-w-8 rounded px-0.5 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] focus:ring-2 focus:ring-emerald-300 ${className}`}
    onInput={schedule}
    onBlur={flush}
    onCompositionStart={() => { composingRef.current = true }}
    onCompositionEnd={() => { composingRef.current = false; schedule() }}
    onPaste={(event) => {
      event.preventDefault()
      globalThis.document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    }}
  >{value}</span>
}
