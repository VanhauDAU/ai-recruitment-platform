import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Upload, message } from 'antd'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CvDocumentPreview, getOrderedItems, getRendererContract, getSectionDefinition, uploadCvAsset } from '@/entities/cv'
import InlineText from './InlineText'
import RichTextArea from './RichTextArea'

function parseId(value) {
  const [type, sectionId, itemId] = String(value).split(':')
  return { type, sectionId, itemId }
}

function SortableItem({ item, section, onChange, onRemove, onMove, registerPendingEdit }) {
  const id = `item:${section.instance_id}:${item.item_id}`
  const sortable = useSortable({ id })
  const fields = ['role', 'company', 'name', 'degree', 'institution', 'title', 'value', 'issuer', 'organization']
  const titleFields = new Set(['role', 'name', 'degree', 'title'])
  return <div ref={sortable.setNodeRef} data-cv-item-id={`${section.instance_id}:${item.item_id}`} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`group/item relative mb-3 rounded-md p-1 hover:bg-emerald-50 ${sortable.isDragging ? 'opacity-40' : ''}`}>
    <button type="button" aria-label={`Kéo item ${item.item_id}`} className="absolute -left-5 top-1 cursor-grab text-slate-400 opacity-100 lg:pointer-events-none lg:opacity-0 lg:group-hover/item:pointer-events-auto lg:group-hover/item:opacity-100 lg:group-focus-within/item:pointer-events-auto lg:group-focus-within/item:opacity-100" {...sortable.attributes} {...sortable.listeners}><HolderOutlined /></button>
    {fields.filter((field) => field in item).map((field) => <div key={field} className={titleFields.has(field) ? 'font-bold text-slate-800' : 'text-slate-600'}><InlineText value={item[field] || ''} placeholder={field} ariaLabel={`${field} ${item.item_id}`} onCommit={(value) => onChange({ [field]: value })} registerPendingEdit={registerPendingEdit} /></div>)}
    {item.description && <RichTextArea value={item.description} ariaLabel={`Mô tả ${item.item_id}`} onCommit={(description) => onChange({ description })} registerPendingEdit={registerPendingEdit} />}
    <div className="absolute right-0 top-0 flex gap-1 rounded bg-white/90 lg:pointer-events-none lg:opacity-0 lg:group-hover/item:pointer-events-auto lg:group-hover/item:opacity-100 lg:group-focus-within/item:pointer-events-auto lg:group-focus-within/item:opacity-100"><button type="button" aria-label={`Đưa item ${item.item_id} lên`} onClick={() => onMove(-1)}><ArrowUpOutlined /></button><button type="button" aria-label={`Đưa item ${item.item_id} xuống`} onClick={() => onMove(1)}><ArrowDownOutlined /></button><button type="button" aria-label={`Xóa item ${item.item_id}`} onClick={onRemove} className="text-rose-500"><DeleteOutlined /></button></div>
  </div>
}

function DragHandle({ id, attributes, listeners }) {
  return <button type="button" aria-label={`Kéo section ${id}`} title="Kéo thả để di chuyển mục" className="absolute -left-6 top-1 cursor-grab text-slate-400 opacity-100 lg:pointer-events-none lg:opacity-0 lg:group-hover/section:pointer-events-auto lg:group-hover/section:opacity-100 lg:group-focus-within/section:pointer-events-auto lg:group-focus-within/section:opacity-100" {...attributes} {...listeners}><HolderOutlined /></button>
}

function SortableSection({ section, document, personal, assets, pageNumber, onRename, onItemChange, onAddItem, onRemoveItem, onMoveItem, onMoveSection, onRemoveSection, registerPendingEdit, onPersonalChange }) {
  const sortable = useSortable({ id: `section:${section.instance_id}:${pageNumber}` })
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
  const definition = getSectionDefinition(section.section_key)
  const items = getOrderedItems(document, section)
  const handle = <DragHandle id={section.instance_id} attributes={sortable.attributes} listeners={sortable.listeners} />

  if (section.section_key === 'nameplate') return <section ref={sortable.setNodeRef} style={style} className="group/section relative mb-5">{handle}<InlineText value={personal.full_name || ''} placeholder="Họ và tên" ariaLabel="Họ và tên inline" className="text-2xl font-extrabold" onCommit={(full_name) => onPersonalChange({ full_name })} registerPendingEdit={registerPendingEdit} /><div><InlineText value={personal.headline || ''} placeholder="Chức danh mong muốn" ariaLabel="Chức danh inline" className="font-semibold text-[var(--cv-theme)]" onCommit={(headline) => onPersonalChange({ headline })} registerPendingEdit={registerPendingEdit} /></div></section>
  if (section.section_key === 'contact') return <section ref={sortable.setNodeRef} style={style} className="group/section relative mb-5 text-slate-600">{handle}<InlineText value={personal.email || ''} placeholder="Email" ariaLabel="Email inline" onCommit={(email) => onPersonalChange({ email })} registerPendingEdit={registerPendingEdit} /> · <InlineText value={personal.phone || ''} placeholder="Số điện thoại" ariaLabel="Số điện thoại inline" onCommit={(phone) => onPersonalChange({ phone })} registerPendingEdit={registerPendingEdit} /> · <InlineText value={personal.address || ''} placeholder="Địa chỉ" ariaLabel="Địa chỉ inline" onCommit={(address) => onPersonalChange({ address })} registerPendingEdit={registerPendingEdit} /></section>
  if (section.section_key === 'avatar') {
    const avatar = assets?.[personal.avatar_asset_id]
    return <section ref={sortable.setNodeRef} style={style} className="group/section relative mb-5">{handle}<Upload showUploadList={false} accept="image/jpeg,image/png,image/webp" beforeUpload={async (file) => { try { const uploaded = await uploadCvAsset(file); onPersonalChange({ avatar_asset_id: uploaded.public_id }, uploaded); message.success('Đã cập nhật ảnh đại diện') } catch { message.error('Không thể tải ảnh đại diện') } return false }}><button type="button" className="rounded-full focus:ring-2 focus:ring-emerald-400">{avatar?.url ? <img src={avatar.url} alt="Ảnh đại diện" className="h-24 w-24 rounded-full object-cover" /> : <span className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-xs">Tải ảnh</span>}</button></Upload></section>
  }

  return <section id={pageNumber === 1 ? `cv-section-${section.instance_id}` : undefined} ref={sortable.setNodeRef} style={style} className={`group/section relative mb-5 rounded p-1 hover:bg-emerald-50/40 ${sortable.isDragging ? 'opacity-40' : ''}`}>
    {handle}
    <div className="mb-2 flex items-center gap-2 border-b pb-1 text-sm font-bold uppercase tracking-wide text-[var(--cv-theme)]"><InlineText value={section.title || definition?.displayName || ''} placeholder="Tiêu đề mục" ariaLabel={`Tiêu đề ${section.instance_id}`} onCommit={onRename} registerPendingEdit={registerPendingEdit} /><div className="ml-auto flex gap-1 rounded bg-white/90 lg:pointer-events-none lg:opacity-0 lg:group-hover/section:pointer-events-auto lg:group-hover/section:opacity-100 lg:group-focus-within/section:pointer-events-auto lg:group-focus-within/section:opacity-100"><button type="button" aria-label={`Đưa section ${section.instance_id} lên`} onClick={() => onMoveSection(-1)}><ArrowUpOutlined /></button><button type="button" aria-label={`Đưa section ${section.instance_id} xuống`} onClick={() => onMoveSection(1)}><ArrowDownOutlined /></button>{definition?.deletable !== false && <button type="button" aria-label={`Xóa section ${section.instance_id}`} onClick={onRemoveSection} className="text-rose-500"><DeleteOutlined /></button>}</div></div>
    <SortableContext items={items.map((item) => `item:${section.instance_id}:${item.item_id}`)} strategy={verticalListSortingStrategy}>{items.map((item) => <SortableItem key={item.item_id} item={item} section={section} onChange={(patch) => onItemChange(item.item_id, patch)} onRemove={() => onRemoveItem(item.item_id)} onMove={(direction) => onMoveItem(item.item_id, direction)} registerPendingEdit={registerPendingEdit} />)}</SortableContext>
    {definition?.requiresItems && <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAddItem}>Thêm nội dung</Button>}
  </section>
}

function EditableRegion({ region, document, pageNumber, ...props }) {
  const droppable = useDroppable({ id: `region:${region.id}:${pageNumber}` })
  return <div key={`${region.id}:${pageNumber}`} ref={droppable.setNodeRef} className={`min-w-0 rounded p-1 ${droppable.isOver ? 'bg-emerald-50 ring-2 ring-emerald-300' : ''}`}><SortableContext items={region.sections.map((section) => `section:${section.instance_id}:${pageNumber}`)} strategy={verticalListSortingStrategy}>{region.sections.map((section) => <div key={section.instance_id} data-section-id={section.instance_id}><SortableSection
    section={section}
    document={document}
    pageNumber={pageNumber}
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

export default function CvEditableCanvas({ editor, zoom, onMoveSection, onMoveItem, onMoveItemDirection, onMoveSectionDirection, onRenameSection, onItemChange, onAddItem, onRemoveItem, onRemoveSection, onPersonalChange }) {
  const rendererKey = editor.cv.template_renderer_key || editor.cv.template_version
  const contract = getRendererContract(rendererKey)
  const personal = editor.document.content_json.personal_info || {}
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const dragEnd = ({ active, over }) => {
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
  const header = () => contract.key !== 'header_two_column_v1' ? <header className="mb-6 border-l-4 pl-4" style={{ borderColor: editor.document.style_json.theme_color }}><InlineText value={personal.full_name || ''} placeholder="Họ và tên" ariaLabel="Họ và tên inline" className="text-2xl font-extrabold" onCommit={(full_name) => onPersonalChange({ full_name })} registerPendingEdit={editor.registerPendingEdit} /><div><InlineText value={personal.headline || ''} placeholder="Chức danh mong muốn" ariaLabel="Chức danh inline" className="font-semibold text-[var(--cv-theme)]" onCommit={(headline) => onPersonalChange({ headline })} registerPendingEdit={editor.registerPendingEdit} /></div><div className="text-slate-600"><InlineText value={personal.email || ''} placeholder="Email" ariaLabel="Email inline" onCommit={(email) => onPersonalChange({ email })} registerPendingEdit={editor.registerPendingEdit} /> · <InlineText value={personal.phone || ''} placeholder="Số điện thoại" ariaLabel="Số điện thoại inline" onCommit={(phone) => onPersonalChange({ phone })} registerPendingEdit={editor.registerPendingEdit} /></div></header> : null

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><div aria-label="CV A4 có thể chỉnh sửa" onKeyDownCapture={historyKey} className="mx-auto origin-top" style={{ width: `${210 * zoom}mm` }}><div className="origin-top-left" style={{ width: '216mm', transform: `scale(${zoom})` }}><CvDocumentPreview
    document={editor.document}
    rendererKey={rendererKey}
    assets={editor.assets}
    editorChrome={false}
    pageLabelVariant="badge"
    renderHeader={header}
    renderRegion={(region, pageNumber) => <EditableRegion key={`${region.id}:${pageNumber}`} region={region} pageNumber={pageNumber} document={editor.document} personal={personal} assets={editor.assets} onRenameSection={onRenameSection} onItemChange={onItemChange} onAddItem={onAddItem} onRemoveItem={onRemoveItem} onMoveItem={onMoveItemDirection} onMoveSectionDirection={onMoveSectionDirection} onRemoveSection={onRemoveSection} registerPendingEdit={editor.registerPendingEdit} onPersonalChange={onPersonalChange} />}
  /></div></div></DndContext>
}
