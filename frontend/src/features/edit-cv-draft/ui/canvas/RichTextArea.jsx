import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BoldOutlined, ItalicOutlined, UnorderedListOutlined, UnderlineOutlined } from '@ant-design/icons'
import { Button, ColorPicker, InputNumber, Select } from 'antd'
import { setMarkInRange, toRichTextV2, toggleBooleanMarkInRange, toggleBulletBlocks } from '@/entities/cv'
import { domToRichText, renderRichText, restoreSelectionOffsets, selectionOffsets } from '../../model/rich-text-dom'
import './RichTextArea.css'

const FONTS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((value) => ({ value, label: value }))
const DEFAULT_MARKS = Object.freeze({ font_family: 'Roboto', font_size_pt: 11, color: '#1F2937' })

function selectedBlockRange(value, offsets) {
  let cursor = 0
  let startBlock = 0
  let endBlock = value.content.length - 1
  for (let index = 0; index < value.content.length; index += 1) {
    const blockEnd = cursor + value.content[index].text.length
    if (offsets.start >= cursor && offsets.start <= blockEnd) startBlock = index
    if (offsets.end >= cursor && offsets.end <= blockEnd) { endBlock = index; break }
    cursor = blockEnd + 1
  }
  return { startBlock, endBlock }
}

function marksAtSelection(value, offsets, defaults) {
  const selected = []
  let cursor = 0
  for (let blockIndex = 0; blockIndex < value.content.length; blockIndex += 1) {
    for (const run of value.content[blockIndex].runs || []) {
      const start = cursor
      const end = start + run.text.length
      const intersects = offsets.start === offsets.end
        ? offsets.start >= start && offsets.start <= end
        : offsets.end > start && offsets.start < end
      if (intersects) selected.push(run.marks || {})
      cursor = end
    }
    if (blockIndex < value.content.length - 1) cursor += 1
  }
  const common = { ...defaults }
  for (const key of ['bold', 'italic', 'underline', 'font_family', 'font_size_pt', 'color']) {
    const values = selected.map((marks) => marks[key])
    if (values.length && values.every((entry) => entry === values[0]) && values[0] != null) common[key] = values[0]
    else if (key === 'bold' || key === 'italic' || key === 'underline') common[key] = false
  }
  return common
}

export default function RichTextArea({ value, ariaLabel, placeholder, onCommit, registerPendingEdit, defaultFontFamily, defaultFontSizePt = 11, defaultColor = '#1F2937' }) {
  const rootRef = useRef(null)
  const toolbarRef = useRef(null)
  const selectionRef = useRef(null)
  const timerRef = useRef(null)
  const focusedRef = useRef(false)
  const colorPickerOpenRef = useRef(false)
  const [focused, setFocused] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState(null)
  const defaults = useMemo(() => ({
    ...DEFAULT_MARKS,
    font_family: defaultFontFamily || DEFAULT_MARKS.font_family,
    font_size_pt: defaultFontSizePt,
    color: defaultColor,
  }), [defaultColor, defaultFontFamily, defaultFontSizePt])
  const [activeMarks, setActiveMarks] = useState(defaults)
  const current = useMemo(() => toRichTextV2(value), [value])

  const positionToolbar = useCallback(() => {
    // Anchor above the top-right of the whole entry (TopCV-style): the fields
    // are left-aligned, so a right-aligned toolbar never covers the line the
    // user wants to click next.
    const anchor = rootRef.current?.closest('.cv-editor-item, .cv-editor-section, .cv-editor-header') || rootRef.current
    const rect = anchor?.getBoundingClientRect()
    if (!rect) return
    const viewportWidth = globalThis.innerWidth || 1024
    const toolbarWidth = Math.min(430, viewportWidth - 24)
    const left = Math.max(12, Math.min(rect.right - toolbarWidth, viewportWidth - toolbarWidth - 12))
    const openBelow = rect.top < 72
    setToolbarPosition({ left, top: openBelow ? rect.bottom + 8 : rect.top - 8, openBelow, width: toolbarWidth })
  }, [])

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const next = rootRef.current ? domToRichText(rootRef.current) : current
    if (JSON.stringify(next) !== JSON.stringify(current)) onCommit(next)
  }, [current, onCommit])

  useEffect(() => {
    const unregister = registerPendingEdit?.(flush)
    return () => {
      clearTimeout(timerRef.current)
      unregister?.()
    }
  }, [flush, registerPendingEdit])

  useLayoutEffect(() => {
    if (!focusedRef.current) renderRichText(rootRef.current, current)
  }, [current])

  useEffect(() => {
    if (!focused) return undefined
    const update = () => positionToolbar()
    globalThis.addEventListener?.('resize', update)
    globalThis.addEventListener?.('scroll', update, true)
    return () => {
      globalThis.removeEventListener?.('resize', update)
      globalThis.removeEventListener?.('scroll', update, true)
    }
  }, [focused, positionToolbar])

  useEffect(() => {
    if (!focused) return undefined
    const preserveRange = () => {
      const offsets = selectionOffsets(rootRef.current)
      // A click on the floating toolbar collapses the browser selection. Keep
      // the last real range so the command still applies to the highlighted text.
      if (!offsets || offsets.start === offsets.end) return
      selectionRef.current = offsets
      setActiveMarks(marksAtSelection(domToRichText(rootRef.current), offsets, defaults))
    }
    globalThis.document?.addEventListener('selectionchange', preserveRange)
    return () => globalThis.document?.removeEventListener('selectionchange', preserveRange)
  }, [defaults, focused])

  const rememberSelection = () => {
    const offsets = selectionOffsets(rootRef.current)
    if (!offsets) return
    if (offsets.start !== offsets.end) selectionRef.current = offsets
    setActiveMarks(marksAtSelection(domToRichText(rootRef.current), offsets, defaults))
  }

  const selectedOffsets = () => {
    const live = selectionOffsets(rootRef.current)
    return live && live.start !== live.end ? live : selectionRef.current
  }

  const applyFormat = (next, offsets) => {
    clearTimeout(timerRef.current)
    renderRichText(rootRef.current, next)
    onCommit(next)
    setActiveMarks(marksAtSelection(next, offsets, defaults))
    globalThis.requestAnimationFrame?.(() => {
      restoreSelectionOffsets(rootRef.current, offsets)
      rootRef.current?.focus()
    })
  }

  const mark = (name, markValue = true, toggle = false) => {
    const offsets = selectedOffsets()
    if (!offsets || offsets.start === offsets.end) return
    const source = domToRichText(rootRef.current)
    const next = toggle
      ? toggleBooleanMarkInRange(source, offsets.start, offsets.end, name)
      : setMarkInRange(source, offsets.start, offsets.end, name, markValue)
    applyFormat(next, offsets)
  }

  const toggleBullets = () => {
    const offsets = selectedOffsets()
    if (!offsets) return
    const source = domToRichText(rootRef.current)
    const { startBlock, endBlock } = selectedBlockRange(source, offsets)
    applyFormat(toggleBulletBlocks(source, startBlock, endBlock), offsets)
  }

  const schedule = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 400)
  }

  const closeWhenFocusLeavesEditor = () => {
    globalThis.requestAnimationFrame?.(() => {
      const activeElement = globalThis.document.activeElement
      if (colorPickerOpenRef.current || rootRef.current?.contains(activeElement) || toolbarRef.current?.contains(activeElement)) return
      focusedRef.current = false
      setFocused(false)
      setToolbarPosition(null)
      flush()
      // Re-render the committed value so leftover empty nodes from deletions
      // disappear and the :empty placeholder can show again.
      renderRichText(rootRef.current, domToRichText(rootRef.current))
    })
  }

  const toolbar = focused && toolbarPosition && globalThis.document && createPortal(<div ref={toolbarRef} role="toolbar" aria-label="Định dạng văn bản" className="cv-rich-text__toolbar fixed z-[1000] flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl" style={{ left: toolbarPosition.left, top: toolbarPosition.top, width: toolbarPosition.width, transform: toolbarPosition.openBelow ? undefined : 'translateY(-100%)' }} onBlurCapture={closeWhenFocusLeavesEditor} onPointerDownCapture={rememberSelection} onMouseDownCapture={rememberSelection} onMouseDown={(event) => { if (event.target.closest?.('button')) event.preventDefault() }}>
    <Select aria-label="Font vùng chọn" size="small" value={activeMarks.font_family} options={FONTS} className="w-28" onChange={(font) => mark('font_family', font)} />
    <InputNumber aria-label="Cỡ chữ vùng chọn" size="small" min={8} max={32} value={activeMarks.font_size_pt} className="w-[4.7rem]" onChange={(size) => size && mark('font_size_pt', size)} />
    <ColorPicker aria-label="Màu vùng chọn" size="small" value={activeMarks.color} onOpenChange={(open) => { colorPickerOpenRef.current = open }} onChange={(_, hex) => mark('color', hex.toUpperCase())} />
    <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
    <Button size="small" type={activeMarks.bold ? 'primary' : 'default'} aria-label="In đậm" icon={<BoldOutlined />} onClick={() => mark('bold', true, true)} />
    <Button size="small" type={activeMarks.italic ? 'primary' : 'default'} aria-label="In nghiêng" icon={<ItalicOutlined />} onClick={() => mark('italic', true, true)} />
    <Button size="small" type={activeMarks.underline ? 'primary' : 'default'} aria-label="Gạch chân" icon={<UnderlineOutlined />} onClick={() => mark('underline', true, true)} />
    <Button size="small" aria-label="Danh sách" icon={<UnorderedListOutlined />} onClick={toggleBullets} />
  </div>, globalThis.document.body)

  return <div className="relative">
    {toolbar}
    <div ref={rootRef} role="textbox" aria-label={ariaLabel} aria-placeholder={placeholder} data-placeholder={placeholder} contentEditable suppressContentEditableWarning className="cv-rich-text min-h-8 rounded-md px-2 py-1 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-300" onFocus={() => { focusedRef.current = true; setFocused(true); positionToolbar(); rememberSelection() }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={closeWhenFocusLeavesEditor} onInput={() => { schedule(); rememberSelection() }} onPaste={(event) => { event.preventDefault(); globalThis.document.execCommand('insertText', false, event.clipboardData.getData('text/plain')) }} />
  </div>
}
