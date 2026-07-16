import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export default function InlineText({ value = '', placeholder, ariaLabel, className = '', onCommit, registerPendingEdit }) {
  const rootRef = useRef(null)
  const timerRef = useRef(null)
  const composingRef = useRef(false)
  const focusedRef = useRef(false)
  const pendingRef = useRef(value)
  const valueRef = useRef(value)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const next = pendingRef.current.trimEnd()
    if (next !== valueRef.current) onCommit(next)
  }, [onCommit])

  useEffect(() => {
    const unregister = registerPendingEdit?.(flush)
    return () => {
      clearTimeout(timerRef.current)
      unregister?.()
    }
  }, [flush, registerPendingEdit])

  useLayoutEffect(() => {
    const element = rootRef.current
    valueRef.current = value
    if (!element || focusedRef.current) return
    if (element.textContent !== value) element.textContent = value
    pendingRef.current = value
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
    onFocus={() => {
      focusedRef.current = true
      pendingRef.current = rootRef.current?.textContent || ''
    }}
    onInput={schedule}
    onBlur={() => {
      focusedRef.current = false
      flush()
    }}
    onCompositionStart={() => { composingRef.current = true }}
    onCompositionEnd={() => { composingRef.current = false; schedule() }}
    onPaste={(event) => {
      event.preventDefault()
      globalThis.document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    }}
  />
}
