import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoldOutlined, ItalicOutlined, UnorderedListOutlined, UnderlineOutlined } from '@ant-design/icons'
import { Button, ColorPicker, InputNumber, Select } from 'antd'
import { setMarkInRange, toRichTextV2, toggleBooleanMarkInRange, toggleBulletBlocks } from '@/entities/cv'
import { domToRichText, selectionOffsets } from '../../model/rich-text-dom'

const FONTS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((value) => ({ value, label: value }))

function RichRuns({ value }) {
  return value.content.map((block, blockIndex) => {
    const content = block.runs.map((run, runIndex) => <span key={`${blockIndex}-${runIndex}`} style={{ fontWeight: run.marks?.bold ? 700 : undefined, fontStyle: run.marks?.italic ? 'italic' : undefined, textDecoration: run.marks?.underline ? 'underline' : undefined, fontFamily: run.marks?.font_family, fontSize: run.marks?.font_size_pt ? `${run.marks.font_size_pt}pt` : undefined, color: run.marks?.color }}>{run.text}</span>)
    return block.type === 'bullet' ? <li key={blockIndex}>{content}</li> : <div key={blockIndex}>{content}</div>
  })
}

export default function RichTextArea({ value, ariaLabel, onCommit, registerPendingEdit }) {
  const rootRef = useRef(null)
  const toolbarRef = useRef(null)
  const selectionRef = useRef(null)
  const timerRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const [local, setLocal] = useState(() => toRichTextV2(value))
  const current = useMemo(() => toRichTextV2(value), [value])
  useEffect(() => { if (!focused) setLocal(current) }, [current, focused])

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const next = rootRef.current ? domToRichText(rootRef.current) : local
    if (JSON.stringify(next) !== JSON.stringify(current)) onCommit(next)
  }, [current, local, onCommit])
  useEffect(() => registerPendingEdit?.(flush), [flush, registerPendingEdit])

  const input = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 400)
  }
  const mark = (name, markValue = true, toggle = false) => {
    const offsets = selectionOffsets(rootRef.current) || selectionRef.current
    if (!offsets || offsets.start === offsets.end) return
    const source = domToRichText(rootRef.current)
    const next = toggle
      ? toggleBooleanMarkInRange(source, offsets.start, offsets.end, name)
      : setMarkInRange(source, offsets.start, offsets.end, name, markValue)
    setLocal(next)
    onCommit(next)
  }
  const rememberSelection = () => {
    const offsets = selectionOffsets(rootRef.current)
    if (offsets) selectionRef.current = offsets
  }
  const toolbarMouseDown = (event) => {
    if (event.target.closest('button')) event.preventDefault()
  }

  return <div className="relative">
    {focused && <div ref={toolbarRef} role="toolbar" aria-label="Định dạng văn bản" className="sticky top-2 z-30 mb-1 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" onMouseDown={toolbarMouseDown}>
      <Button size="small" aria-label="In đậm" icon={<BoldOutlined />} onClick={() => mark('bold', true, true)} />
      <Button size="small" aria-label="In nghiêng" icon={<ItalicOutlined />} onClick={() => mark('italic', true, true)} />
      <Button size="small" aria-label="Gạch chân" icon={<UnderlineOutlined />} onClick={() => mark('underline', true, true)} />
      <Button size="small" aria-label="Danh sách" icon={<UnorderedListOutlined />} onClick={() => { const next = toggleBulletBlocks(domToRichText(rootRef.current), 0, local.content.length - 1); setLocal(next); onCommit(next) }} />
      <Select aria-label="Font vùng chọn" size="small" options={FONTS} className="w-28" onChange={(font) => mark('font_family', font)} />
      <InputNumber aria-label="Cỡ chữ vùng chọn" size="small" min={8} max={32} className="w-16" onChange={(size) => mark('font_size_pt', size)} />
      <ColorPicker size="small" onChange={(_, hex) => mark('color', hex.toUpperCase())} />
    </div>}
    <div ref={rootRef} role="textbox" aria-label={ariaLabel} contentEditable suppressContentEditableWarning className="min-h-7 rounded px-1 outline-none focus:ring-2 focus:ring-emerald-300" onFocus={() => setFocused(true)} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={(event) => { if (toolbarRef.current?.contains(event.relatedTarget)) return; setFocused(false); flush() }} onInput={input} onPaste={(event) => { event.preventDefault(); globalThis.document.execCommand('insertText', false, event.clipboardData.getData('text/plain')) }}><RichRuns value={local} /></div>
  </div>
}
