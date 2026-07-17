import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BoldOutlined, ItalicOutlined, UnderlineOutlined } from '@ant-design/icons'
import { Button, ColorPicker, InputNumber, Select } from 'antd'
import { createPortal } from 'react-dom'

const FONTS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((value) => ({ value, label: value }))

export default function InlineText({ value = '', placeholder, ariaLabel, className = '', onCommit, registerPendingEdit, marks = {}, onMarksChange, defaultFontFamily = 'Roboto' }) {
  const rootRef = useRef(null)
  const timerRef = useRef(null)
  const composingRef = useRef(false)
  const focusedRef = useRef(false)
  const colorPickerOpenRef = useRef(false)
  const pendingRef = useRef(value)
  const valueRef = useRef(value)
  const toolbarRef = useRef(null)
  const [toolbarPosition, setToolbarPosition] = useState(null)

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

  const positionToolbar = useCallback(() => {
    // Anchor above the top-right of the surrounding entry (TopCV-style) so the
    // toolbar never covers the left-aligned line the user wants to click next.
    const anchor = rootRef.current?.closest('.cv-editor-item, .cv-editor-section, .cv-editor-header') || rootRef.current
    const rect = anchor?.getBoundingClientRect()
    if (!rect) return
    const viewportWidth = globalThis.innerWidth || 1024
    const toolbarWidth = Math.min(360, viewportWidth - 24)
    const right = Math.max(12, Math.min(viewportWidth - rect.right, viewportWidth - toolbarWidth - 12))
    const openBelow = rect.top < 64
    setToolbarPosition({ right, top: openBelow ? rect.bottom + 6 : rect.top - 6, openBelow })
  }, [])

  const closeWhenFocusLeaves = () => {
    globalThis.requestAnimationFrame?.(() => {
      const active = globalThis.document.activeElement
      if (colorPickerOpenRef.current || rootRef.current?.contains(active) || toolbarRef.current?.contains(active)) return
      setToolbarPosition(null)
      focusedRef.current = false
      flush()
    })
  }

  useEffect(() => {
    if (!toolbarPosition) return undefined
    const reposition = () => positionToolbar()
    globalThis.addEventListener?.('resize', reposition)
    globalThis.addEventListener?.('scroll', reposition, true)
    return () => {
      globalThis.removeEventListener?.('resize', reposition)
      globalThis.removeEventListener?.('scroll', reposition, true)
    }
  }, [positionToolbar, toolbarPosition])

  const updateMarks = (patch) => onMarksChange?.({ ...marks, ...patch })
  const inlineStyle = {
    color: marks.color,
    fontFamily: marks.font_family || defaultFontFamily,
    fontSize: marks.font_size_pt ? `${marks.font_size_pt}pt` : undefined,
    fontWeight: marks.bold ? 700 : undefined,
    fontStyle: marks.italic ? 'italic' : undefined,
    textDecoration: marks.underline ? 'underline' : undefined,
  }

  const toolbar = toolbarPosition && globalThis.document && createPortal(<div ref={toolbarRef} role="toolbar" aria-label="Thao tác văn bản ngắn" className="fixed z-[1000] flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xl" style={{ right: toolbarPosition.right, top: toolbarPosition.top, transform: toolbarPosition.openBelow ? undefined : 'translateY(-100%)' }} onBlurCapture={closeWhenFocusLeaves} onMouseDown={(event) => { if (event.target.closest?.('button')) event.preventDefault() }}>
    <Select aria-label="Font văn bản" size="small" value={marks.font_family || defaultFontFamily} options={FONTS} className="w-28" onChange={(font_family) => updateMarks({ font_family })} />
    <InputNumber aria-label="Cỡ chữ văn bản" size="small" min={8} max={32} value={marks.font_size_pt || 11} className="w-[4.7rem]" onChange={(font_size_pt) => font_size_pt && updateMarks({ font_size_pt })} />
    <ColorPicker aria-label="Màu văn bản" size="small" value={marks.color || '#1F2937'} onOpenChange={(open) => { colorPickerOpenRef.current = open }} onChange={(_, color) => updateMarks({ color: color.toUpperCase() })} />
    <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
    <Button size="small" type={marks.bold ? 'primary' : 'default'} aria-label="In đậm văn bản" icon={<BoldOutlined />} onClick={() => updateMarks({ bold: !marks.bold })} />
    <Button size="small" type={marks.italic ? 'primary' : 'default'} aria-label="In nghiêng văn bản" icon={<ItalicOutlined />} onClick={() => updateMarks({ italic: !marks.italic })} />
    <Button size="small" type={marks.underline ? 'primary' : 'default'} aria-label="Gạch chân văn bản" icon={<UnderlineOutlined />} onClick={() => updateMarks({ underline: !marks.underline })} />
  </div>, globalThis.document.body)

  return <><span
    ref={rootRef}
    role="textbox"
    aria-label={ariaLabel}
    aria-placeholder={placeholder}
    contentEditable
    suppressContentEditableWarning
    data-placeholder={placeholder}
    style={inlineStyle}
    className={`inline-block min-h-7 min-w-8 rounded-md border border-transparent bg-white/40 px-1.5 py-0.5 outline-none transition empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] hover:border-slate-200 hover:bg-white focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200 ${className}`}
    onFocus={() => {
      focusedRef.current = true
      pendingRef.current = rootRef.current?.textContent || ''
      positionToolbar()
    }}
    onInput={schedule}
    onBlur={() => {
      focusedRef.current = false
      closeWhenFocusLeaves()
    }}
    onCompositionStart={() => { composingRef.current = true }}
    onCompositionEnd={() => { composingRef.current = false; schedule() }}
    onPaste={(event) => {
      event.preventDefault()
      globalThis.document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    }}
  />{toolbar}</>
}
