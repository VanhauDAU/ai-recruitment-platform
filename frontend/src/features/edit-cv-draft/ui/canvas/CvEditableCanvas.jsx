import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CvDocumentPreview, getCvUiText, getOrderedItems, getRendererContract, getSectionDefinition } from '@/entities/cv'
import InlineText from './InlineText'
import RichTextArea from './RichTextArea'
import AvatarUploadModal from './AvatarUploadModal'

function parseId(value) {
  const [type, sectionId, itemId] = String(value).split(':')
  return { type, sectionId, itemId }
}

function CanvasActionButton({ label, ariaLabel = label, tone = 'default', className = '', children, ...props }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 text-rose-600 hover:border-rose-500 hover:bg-rose-500 hover:text-white'
    : 'border-slate-200 text-slate-600 hover:border-[var(--cv-theme)] hover:bg-[color:var(--cv-theme)] hover:text-white'
  return <Tooltip title={label}><button type="button" aria-label={ariaLabel} className={`flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-md border bg-white px-1 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-30 ${toneClass} ${className}`} {...props}>{children}</button></Tooltip>
}

function personalStyleId(field) {
  return `personal:${field}`
}

function hasRichTextContent(value) {
  return value?.content?.some((block) => block.text?.trim() || block.runs?.some((run) => run.text?.trim()))
}

function clampAvatarSize(value) {
  const number = Number(value)
  return Math.min(80, Math.max(20, Number.isFinite(number) ? number : 28))
}

function avatarPosition(value) {
  const number = Number(value)
  return Math.min(100, Math.max(0, Number.isFinite(number) ? number : 50))
}

function avatarZoom(value) {
  const number = Number(value)
  return Math.min(3, Math.max(1, Number.isFinite(number) ? number : 1))
}

function ResizableAvatar({ avatar, personal, locale, onOpen, onSizeChange }) {
  const storedSize = clampAvatarSize(personal.avatar_size_mm)
  const [size, setSize] = useState(storedSize)
  const resizeRef = useRef(null)

  useEffect(() => setSize(storedSize), [storedSize])

  const startResize = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.parentElement.getBoundingClientRect()
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startSize: size,
      nextSize: size,
      pixelsPerMm: Math.max(rect.width / size, 0.1),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const resize = (event) => {
    const state = resizeRef.current
    if (!state || state.pointerId !== event.pointerId) return
    const nextSize = clampAvatarSize(Math.round((state.startSize + ((event.clientX - state.startX) / state.pixelsPerMm)) * 2) / 2)
    state.nextSize = nextSize
    setSize(nextSize)
  }
  const finishResize = (event) => {
    const state = resizeRef.current
    if (!state || state.pointerId !== event.pointerId) return
    resizeRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    onSizeChange(state.nextSize)
  }

  const position = {
    x: avatarPosition(personal.avatar_position?.x),
    y: avatarPosition(personal.avatar_position?.y),
  }
  const zoom = avatarZoom(personal.avatar_zoom)

  return <div className="group/avatar relative mx-auto" style={{ width: `${size}mm`, height: `${size}mm` }}>
    <button type="button" aria-label="Cập nhật ảnh đại diện" onClick={onOpen} className="h-full w-full cursor-pointer overflow-hidden rounded-full focus:ring-2 focus:ring-[var(--cv-theme)]">
      {avatar?.url
        ? <img src={avatar.url} alt={getCvUiText('upload_avatar', locale)} draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${zoom})`, transformOrigin: `${position.x}% ${position.y}%` }} />
        : <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 px-2 text-center text-xs">{getCvUiText('upload_avatar', locale)}</span>}
    </button>
    <Tooltip title="Kéo để đổi kích thước ảnh">
      <button
        type="button"
        aria-label="Thay đổi kích thước ảnh đại diện"
        className="cv-avatar-resize-handle absolute -bottom-1.5 -right-1.5 z-20 flex h-6 w-6 touch-none cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-[var(--cv-theme)] text-xs font-black text-white shadow-md"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      >↘</button>
    </Tooltip>
  </div>
}

function ContactInputs({ personal, locale, onPersonalChange, registerPendingEdit, inlineTextStyles, onInlineTextStyle, defaultFontFamily }) {
  const fields = ['email', 'phone', 'date_of_birth', 'address', 'website']
  return <div className="cv-contact-list text-slate-600">{fields.map((field) => <div key={field} className="min-w-0"><InlineText value={personal[field] || ''} placeholder={getCvUiText(field, locale)} ariaLabel={`${getCvUiText(field, locale)} inline`} className="block w-full max-w-full break-words" onCommit={(value) => onPersonalChange({ [field]: value })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[personalStyleId(field)]} onMarksChange={(marks) => onInlineTextStyle(personalStyleId(field), marks)} defaultFontFamily={defaultFontFamily} /></div>)}</div>
}

function SortableItem({ item, section, locale, position, total, selected, onSelect, onChange, onRemove, onMove, registerPendingEdit, defaultFontFamily, inlineTextStyles, onInlineTextStyle }) {
  const id = `item:${section.instance_id}:${item.item_id}`
  const sortable = useSortable({ id })
  // The read-only preview and PDF never print a "name" line for the summary
  // section, so the editor must not ask candidates to fill one in.
  const fields = ['start_date', 'end_date', 'role', 'company', 'name', 'degree', 'institution', 'title', 'value', 'issuer', 'organization']
    .filter((field) => !(section.section_key === 'summary' && field === 'name'))
  const titleFields = new Set(['role', 'name', 'degree', 'title'])
  const dateFields = new Set(['start_date', 'end_date'])
  const fieldPlaceholder = (field) => (section.section_key === 'summary' && field === 'value'
    ? getCvUiText('summary_hint', locale)
    : getCvUiText(field, locale))
  const itemSelection = { sectionId: section.instance_id, itemId: item.item_id }
  return <div ref={sortable.setNodeRef} role="group" tabIndex={0} aria-label={`Nội dung ${position + 1} của ${section.title}`} data-active={selected} data-cv-item-id={`${section.instance_id}:${item.item_id}`} onClick={(event) => {
    event.stopPropagation()
    if (event.target.closest?.('[contenteditable="true"],button,input,textarea,[role="combobox"]')) return
    onSelect(itemSelection)
  }} onFocus={(event) => { if (event.currentTarget === event.target) onSelect(itemSelection, { openPanel: false }) }} onKeyDown={(event) => {
    if (event.currentTarget !== event.target || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    onSelect(itemSelection)
  }} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`cv-editor-item group/item relative ${section.section_key === 'skills' ? 'mb-4' : 'mb-3'} outline-none ${sortable.isDragging ? 'opacity-35' : ''} ${sortable.isOver && !sortable.isDragging ? 'ring-2 ring-[var(--cv-theme)]' : ''}`}>
    {sortable.isOver && !sortable.isDragging && <div className="pointer-events-none absolute -top-2 left-2 right-2 z-20 border-t-2 border-emerald-500"><span className="relative -top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white">Thả item tại đây</span></div>}
    <Tooltip title="Kéo để di chuyển nội dung"><button type="button" aria-label={`Kéo item ${item.item_id}`} className="absolute -left-8 top-1 flex h-8 w-8 cursor-grab items-center justify-center text-slate-400 opacity-100 lg:pointer-events-none lg:opacity-0 lg:group-hover/item:pointer-events-auto lg:group-hover/item:opacity-100 lg:group-focus-within/item:pointer-events-auto lg:group-focus-within/item:opacity-100" {...sortable.attributes} {...sortable.listeners}><HolderOutlined /></button></Tooltip>
    {fields.some((field) => dateFields.has(field) && field in item) && <div className="mb-1 flex items-center gap-1 text-slate-600"><InlineText value={item.start_date || ''} placeholder={getCvUiText('start_date', locale)} ariaLabel={`Từ ${item.item_id}`} className="min-w-28" onCommit={(value) => onChange({ start_date: value || null })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[`item:${section.instance_id}:${item.item_id}:start_date`]} onMarksChange={(marks) => onInlineTextStyle(`item:${section.instance_id}:${item.item_id}:start_date`, marks)} defaultFontFamily={defaultFontFamily} /><span className="text-slate-400">–</span><InlineText value={item.end_date || ''} placeholder={getCvUiText('end_date', locale)} ariaLabel={`Đến ${item.item_id}`} className="min-w-28" onCommit={(value) => onChange({ end_date: value || null })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[`item:${section.instance_id}:${item.item_id}:end_date`]} onMarksChange={(marks) => onInlineTextStyle(`item:${section.instance_id}:${item.item_id}:end_date`, marks)} defaultFontFamily={defaultFontFamily} /></div>}
    {fields.filter((field) => !dateFields.has(field) && field in item).map((field) => <div key={field} className={titleFields.has(field) ? 'font-bold text-slate-800' : 'text-slate-600'}><InlineText value={item[field] || ''} placeholder={fieldPlaceholder(field)} ariaLabel={`${field} ${item.item_id}`} className="w-full" onCommit={(value) => onChange({ [field]: value })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[`item:${section.instance_id}:${item.item_id}:${field}`]} onMarksChange={(marks) => onInlineTextStyle(`item:${section.instance_id}:${item.item_id}:${field}`, marks)} defaultFontFamily={defaultFontFamily} /></div>)}
    {hasRichTextContent(item.description) && <RichTextArea value={item.description} ariaLabel={`Mô tả ${item.item_id}`} onCommit={(description) => onChange({ description })} registerPendingEdit={registerPendingEdit} defaultFontFamily={defaultFontFamily} />}
    <div className="cv-item-toolbar absolute -bottom-3 right-0 z-10 flex items-center gap-1"><CanvasActionButton label="Di chuyển lên trên" ariaLabel={`Đưa item ${item.item_id} lên`} disabled={position === 0} onClick={() => onMove(-1)}><ArrowUpOutlined /></CanvasActionButton><CanvasActionButton label="Di chuyển xuống dưới" ariaLabel={`Đưa item ${item.item_id} xuống`} disabled={position === total - 1} onClick={() => onMove(1)}><ArrowDownOutlined /></CanvasActionButton><CanvasActionButton label="Xóa nội dung" ariaLabel={`Xóa item ${item.item_id}`} tone="danger" onClick={onRemove}><DeleteOutlined /><span>Xóa</span></CanvasActionButton></div>
  </div>
}

function SectionToolbar({ section, sortable, position, total, definition, onMoveSection, onRemoveSection }) {
  return <div className="cv-section-toolbar absolute -top-1 right-0 z-10 flex items-center gap-1">
    <Tooltip title="Kéo để di chuyển mục"><button type="button" aria-label={`Kéo section ${section.instance_id}`} className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[var(--cv-theme)] hover:bg-[color:var(--cv-theme)] hover:text-white" {...sortable.attributes} {...sortable.listeners}><HolderOutlined /></button></Tooltip>
    <CanvasActionButton label="Di chuyển mục lên trên" ariaLabel={`Đưa section ${section.instance_id} lên`} disabled={position === 0} onClick={() => onMoveSection(-1)}><ArrowUpOutlined /></CanvasActionButton>
    <CanvasActionButton label="Di chuyển mục xuống dưới" ariaLabel={`Đưa section ${section.instance_id} xuống`} disabled={position === total - 1} onClick={() => onMoveSection(1)}><ArrowDownOutlined /></CanvasActionButton>
    {definition?.deletable !== false && <CanvasActionButton label="Xóa mục" ariaLabel={`Xóa section ${section.instance_id}`} tone="danger" onClick={onRemoveSection}><DeleteOutlined /><span>Xóa</span></CanvasActionButton>}
  </div>
}

function SortableSection({ section, document, personal, assets, pageNumber, position, total, selection, onSelect, onRename, onItemChange, onAddItem, onRemoveItem, onMoveItem, onMoveSection, onRemoveSection, registerPendingEdit, onPersonalChange, onOpenAvatarEditor, inlineTextStyles, onInlineTextStyle }) {
  const sortable = useSortable({ id: `section:${section.instance_id}:${pageNumber}` })
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
  const definition = getSectionDefinition(section.section_key)
  const items = getOrderedItems(document, section)
  const locale = document.content_json.locale
  const selected = selection?.sectionId === section.instance_id
  const sectionSelection = { sectionId: section.instance_id, itemId: null }
  const sectionClass = `cv-editor-section group/section relative mb-5 rounded-lg outline-none ${sortable.isDragging ? 'opacity-35' : ''} ${sortable.isOver && !sortable.isDragging ? 'ring-2 ring-[var(--cv-theme)]' : ''}`
  const selectionProps = {
    'data-active': selected,
    onClick: (event) => {
      if (event.target.closest?.('[contenteditable="true"],button,input,textarea,[role="combobox"]')) return
      onSelect(sectionSelection)
    },
    onFocus: (event) => {
      if (event.currentTarget === event.target) onSelect(sectionSelection, { openPanel: false })
    },
    onKeyDown: (event) => {
      if (event.currentTarget !== event.target || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      onSelect(sectionSelection)
    },
  }

  if (section.section_key === 'nameplate') return <section id={pageNumber === 1 ? `cv-section-${section.instance_id}` : undefined} ref={sortable.setNodeRef} tabIndex={0} aria-label="Mục CV Danh thiếp" style={style} className={sectionClass} {...selectionProps}><InlineText value={personal.full_name || ''} placeholder={getCvUiText('full_name', locale)} ariaLabel="Họ và tên inline" className="text-2xl font-extrabold" onCommit={(full_name) => onPersonalChange({ full_name })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[personalStyleId('full_name')]} onMarksChange={(marks) => onInlineTextStyle(personalStyleId('full_name'), marks)} defaultFontFamily={document.style_json.font_family} /><div><InlineText value={personal.headline || ''} placeholder={getCvUiText('headline', locale)} ariaLabel="Chức danh inline" className="font-semibold text-[var(--cv-theme)]" onCommit={(headline) => onPersonalChange({ headline })} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[personalStyleId('headline')]} onMarksChange={(marks) => onInlineTextStyle(personalStyleId('headline'), marks)} defaultFontFamily={document.style_json.font_family} /></div></section>
  if (section.section_key === 'contact') return <section id={pageNumber === 1 ? `cv-section-${section.instance_id}` : undefined} ref={sortable.setNodeRef} tabIndex={0} aria-label="Mục CV Thông tin liên hệ" style={style} className={`${sectionClass} text-slate-600`} {...selectionProps}><ContactInputs personal={personal} locale={locale} onPersonalChange={onPersonalChange} registerPendingEdit={registerPendingEdit} inlineTextStyles={inlineTextStyles} onInlineTextStyle={onInlineTextStyle} defaultFontFamily={document.style_json.font_family} /></section>
  if (section.section_key === 'avatar') {
    const avatar = assets?.[personal.avatar_asset_id]
    return <section id={pageNumber === 1 ? `cv-section-${section.instance_id}` : undefined} ref={sortable.setNodeRef} tabIndex={0} aria-label="Mục CV Ảnh đại diện" style={style} className={`${sectionClass} flex justify-center`} {...selectionProps}>
      <ResizableAvatar avatar={avatar} personal={personal} locale={locale} onOpen={onOpenAvatarEditor} onSizeChange={(avatar_size_mm) => onPersonalChange({ avatar_size_mm })} />
      <SectionToolbar section={section} sortable={sortable} position={position} total={total} definition={definition} onMoveSection={onMoveSection} onRemoveSection={onRemoveSection} />
    </section>
  }

  return <section id={pageNumber === 1 ? `cv-section-${section.instance_id}` : undefined} ref={sortable.setNodeRef} tabIndex={0} aria-label={`Mục CV ${section.title}`} style={style} className={sectionClass} {...selectionProps}>
    {sortable.isOver && !sortable.isDragging && <div className="pointer-events-none absolute -top-2 left-2 right-2 z-20 border-t-2 border-emerald-500"><span className="relative -top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white">Thả mục tại đây</span></div>}
    <div className="mb-3 flex items-center gap-2 border-b pb-2.5 text-sm font-bold uppercase tracking-wide text-[var(--cv-theme)]"><InlineText value={section.title || definition?.displayName || ''} placeholder={getCvUiText('section_title', locale)} ariaLabel={`Tiêu đề ${section.instance_id}`} onCommit={onRename} registerPendingEdit={registerPendingEdit} marks={inlineTextStyles?.[`section:${section.instance_id}:title`]} onMarksChange={(marks) => onInlineTextStyle(`section:${section.instance_id}:title`, marks)} defaultFontFamily={document.style_json.font_family} /><SectionToolbar section={section} sortable={sortable} position={position} total={total} definition={definition} onMoveSection={onMoveSection} onRemoveSection={onRemoveSection} /></div>
    <SortableContext items={items.map((item) => `item:${section.instance_id}:${item.item_id}`)} strategy={verticalListSortingStrategy}>{items.map((item, itemPosition) => <SortableItem key={item.item_id} item={item} section={section} locale={locale} position={itemPosition} total={items.length} selected={selected && selection?.itemId === item.item_id} onSelect={onSelect} onChange={(patch) => onItemChange(item.item_id, patch)} onRemove={() => onRemoveItem(item.item_id)} onMove={(direction) => onMoveItem(item.item_id, direction)} registerPendingEdit={registerPendingEdit} defaultFontFamily={document.style_json.font_family} inlineTextStyles={inlineTextStyles} onInlineTextStyle={onInlineTextStyle} />)}</SortableContext>
    {!definition?.personalInfoBacked && <Button size="small" type="primary" aria-label={getCvUiText('add_item', locale)} icon={<PlusOutlined />} onClick={onAddItem} className="!absolute -bottom-3 left-2 z-10 !border-emerald-600 !bg-emerald-600 !shadow-md transition-opacity hover:!border-emerald-700 hover:!bg-emerald-700 lg:pointer-events-none lg:opacity-0 lg:group-hover/section:pointer-events-auto lg:group-hover/section:opacity-100 lg:group-focus-within/section:pointer-events-auto lg:group-focus-within/section:opacity-100">{getCvUiText('add_item', locale)}</Button>}
  </section>
}

function EditableRegion({ region, document, pageNumber, ...props }) {
  const droppable = useDroppable({ id: `region:${region.id}:${pageNumber}` })
  return <div key={`${region.id}:${pageNumber}`} ref={droppable.setNodeRef} className={`min-w-0 rounded-lg p-1 transition ${droppable.isOver ? 'bg-emerald-50/80 ring-2 ring-emerald-400' : ''}`}>{droppable.isOver && <div className="mb-1 rounded-md border border-dashed border-emerald-500 bg-emerald-100 px-2 py-1 text-center text-[10px] font-bold text-emerald-800">Thả vào vùng này</div>}<SortableContext items={region.sections.map((section) => `section:${section.instance_id}:${pageNumber}`)} strategy={verticalListSortingStrategy}>{region.sections.map((section, position) => <div key={section.instance_id} data-section-id={section.instance_id}><SortableSection
    section={section}
    document={document}
    pageNumber={pageNumber}
    position={position}
    total={region.sections.length}
    {...props}
    onRename={(title) => props.onRenameSection(section.instance_id, title)}
    onItemChange={(itemId, patch) => props.onItemChange(section.instance_id, itemId, patch)}
    onAddItem={() => props.onAddItem(section.instance_id)}
    onRemoveItem={(itemId) => props.onRemoveItem(section.instance_id, itemId)}
    onMoveItem={(itemId, direction) => props.onMoveItem(section.instance_id, itemId, direction)}
    onMoveSection={(direction) => props.onMoveSectionDirection(section.instance_id, direction)}
    onRemoveSection={() => props.onRemoveSection(section.instance_id)}
  /></div>)}</SortableContext></div>
}

export default function CvEditableCanvas({ editor, zoom, selection, onSelect, onMoveSection, onMoveItem, onMoveItemDirection, onMoveSectionDirection, onRenameSection, onItemChange, onAddItem, onRemoveItem, onRemoveSection, onPersonalChange, onAvatarUpload, onInlineTextStyle }) {
  const rendererKey = editor.cv.template_renderer_key || editor.cv.template_version
  const contract = getRendererContract(rendererKey)
  const personal = editor.document.content_json.personal_info || {}
  const locale = editor.document.content_json.locale
  const inlineTextStyles = editor.document.content_json.inline_text_styles || {}
  const [activeDrag, setActiveDrag] = useState(null)
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const dragEnd = ({ active, over }) => {
    setActiveDrag(null)
    if (!over || active.id === over.id) return
    const source = parseId(active.id)
    const target = parseId(over.id)
    if (source.type === 'section') {
      const targetRegion = target.type === 'region' ? target.sectionId : editor.document.layout_json.regions.find((region) => region.section_instance_ids.includes(target.sectionId))?.id
      if (!targetRegion) return
      const region = editor.document.layout_json.regions.find((candidate) => candidate.id === targetRegion)
      const targetIndex = target.type === 'section' ? region.section_instance_ids.indexOf(target.sectionId) : region.section_instance_ids.length
      onMoveSection(source.sectionId, targetRegion, targetIndex)
    } else if (source.type === 'item' && target.type === 'item' && source.sectionId === target.sectionId) {
      const section = editor.document.content_json.sections.find((candidate) => candidate.instance_id === source.sectionId)
      const targetIndex = getOrderedItems(editor.document, section).findIndex((item) => item.item_id === target.itemId)
      onMoveItem(source.sectionId, source.itemId, targetIndex)
    }
  }
  const historyKey = (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
  }
  const dragPreview = activeDrag && (() => {
    const source = parseId(activeDrag)
    if (source.type === 'section') return editor.document.content_json.sections.find((section) => section.instance_id === source.sectionId)?.title || 'Mục CV'
    const section = editor.document.content_json.sections.find((candidate) => candidate.instance_id === source.sectionId)
    const item = section?.items.find((candidate) => candidate.item_id === source.itemId)
    return item?.role || item?.name || item?.title || item?.value || 'Nội dung CV'
  })()
  const personalSelection = { sectionId: 'personal', itemId: null }
  const header = () => contract.key !== 'header_two_column_v1' ? <header tabIndex={0} aria-label="Thông tin cá nhân trên CV" data-active={selection?.sectionId === 'personal'} onClick={(event) => {
    if (event.target.closest?.('[contenteditable="true"],button,input,textarea,[role="combobox"]')) return
    onSelect(personalSelection)
  }} onFocus={(event) => { if (event.currentTarget === event.target) onSelect(personalSelection, { openPanel: false }) }} onKeyDown={(event) => {
    if (event.currentTarget !== event.target || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    onSelect(personalSelection)
  }} className="mb-4 rounded-lg border-l-4 px-2 py-1.5 outline-none transition hover:bg-emerald-50/70 hover:ring-1 hover:ring-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500 data-[active=true]:bg-emerald-50/70 data-[active=true]:ring-2 data-[active=true]:ring-emerald-500" style={{ borderColor: editor.document.style_json.theme_color }}><InlineText value={personal.full_name || ''} placeholder={getCvUiText('full_name', locale)} ariaLabel="Họ và tên inline" className="text-2xl font-extrabold" onCommit={(full_name) => onPersonalChange({ full_name })} registerPendingEdit={editor.registerPendingEdit} marks={inlineTextStyles[personalStyleId('full_name')]} onMarksChange={(marks) => onInlineTextStyle(personalStyleId('full_name'), marks)} defaultFontFamily={editor.document.style_json.font_family} /><div><InlineText value={personal.headline || ''} placeholder={getCvUiText('headline', locale)} ariaLabel="Chức danh inline" className="font-semibold text-[var(--cv-theme)]" onCommit={(headline) => onPersonalChange({ headline })} registerPendingEdit={editor.registerPendingEdit} marks={inlineTextStyles[personalStyleId('headline')]} onMarksChange={(marks) => onInlineTextStyle(personalStyleId('headline'), marks)} defaultFontFamily={editor.document.style_json.font_family} /></div><ContactInputs personal={personal} locale={locale} onPersonalChange={onPersonalChange} registerPendingEdit={editor.registerPendingEdit} inlineTextStyles={inlineTextStyles} onInlineTextStyle={onInlineTextStyle} defaultFontFamily={editor.document.style_json.font_family} /></header> : null

  return <><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveDrag(active.id)} onDragCancel={() => setActiveDrag(null)} onDragEnd={dragEnd}><div aria-label="CV A4 có thể chỉnh sửa" onKeyDownCapture={historyKey} className="mx-auto origin-top" style={{ width: `${210 * zoom}mm` }}><div className="origin-top-left" style={{ width: '210mm', transform: `scale(${zoom})` }}><CvDocumentPreview
    document={editor.document}
    rendererKey={rendererKey}
    assets={editor.assets}
    editorChrome={false}
    pageLabelVariant="badge"
    renderHeader={header}
    renderRegion={(region, pageNumber) => <EditableRegion key={`${region.id}:${pageNumber}`} region={contract.key === 'header_two_column_v1' ? region : { ...region, sections: region.sections.filter((section) => !['nameplate', 'contact'].includes(section.section_key)) }} pageNumber={pageNumber} document={editor.document} personal={personal} assets={editor.assets} selection={selection} onSelect={onSelect} onRenameSection={onRenameSection} onItemChange={onItemChange} onAddItem={onAddItem} onRemoveItem={onRemoveItem} onMoveItem={onMoveItemDirection} onMoveSectionDirection={onMoveSectionDirection} onRemoveSection={onRemoveSection} registerPendingEdit={editor.registerPendingEdit} onPersonalChange={onPersonalChange} onOpenAvatarEditor={() => setAvatarEditorOpen(true)} inlineTextStyles={inlineTextStyles} onInlineTextStyle={onInlineTextStyle} />}
  /></div></div><DragOverlay dropAnimation={null}>{dragPreview && <div className="flex max-w-64 items-center gap-2 rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-xl"><HolderOutlined className="text-emerald-600" /><span className="truncate">{dragPreview}</span></div>}</DragOverlay></DndContext>
  <AvatarUploadModal
    open={avatarEditorOpen}
    avatar={editor.assets?.[personal.avatar_asset_id]}
    position={personal.avatar_position}
    zoom={personal.avatar_zoom}
    onClose={() => setAvatarEditorOpen(false)}
    onAvatarUpload={onAvatarUpload}
    onComplete={({ avatar, removed, position: avatar_position, zoom: avatar_zoom }) => onPersonalChange({
      avatar_asset_id: removed ? null : (avatar?.public_id || personal.avatar_asset_id),
      avatar_position,
      avatar_zoom,
    }, avatar)}
  />
  </>
}
