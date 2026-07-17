import { CloseOutlined, HolderOutlined } from '@ant-design/icons'
import { Alert, App, Drawer, Modal, Skeleton } from 'antd'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useState } from 'react'
import {
  addItem,
  addSection,
  availableSectionKeys,
  changeContentLocale,
  CvDocumentPreview,
  getEditorCapabilities,
  getOrderedItems,
  getOrderedSections,
  getSectionDefinition,
  getSectionDisplayName,
  moveItemInLayout,
  moveItemToIndexInLayout,
  moveSectionToRegion,
  moveSection,
  removeItem,
  removeSection,
  renameSection,
  resizeRegionPair,
  syncItemOrder,
  updateItem,
  updateInlineTextStyle,
  updatePersonalInfo,
  updateStyle,
  uploadCvAsset,
  validateCvDocument,
} from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useBuilderUi } from '../model/use-builder-ui'
import { BUILDER_TOOLS } from '../model/builder-tools'
import useCvDraftEditor from '../model/use-cv-draft-editor'
import AddSectionsPanel from './panels/AddSectionsPanel'
import AiSuggestPanel from './panels/AiSuggestPanel'
import DesignFontPanel from './panels/DesignFontPanel'
import LayoutPanel from './panels/LayoutPanel'
import CvLegacyDraftEditor from './CvLegacyDraftEditor'
import SampleLibraryPanel from './panels/SampleLibraryPanel'
import BuilderTopBar from './BuilderTopBar'
import CvEditableCanvas from './canvas/CvEditableCanvas'
import CanvasZoomControls from './canvas/CanvasZoomControls'
import EditorSaveState from './EditorSaveState'
import TemplateSwitcher from './TemplateSwitcher'
import ToolSidebar from './ToolSidebar'

// DnD ids share one namespace across the canvas ("section:", "item:",
// "region:"), the layout mini-map ("mini-section:", "mini-region:") and the
// add-section panel ("new:<section_key>").
function parseDndId(value) {
  const [type, sectionId, itemId] = String(value).split(':')
  return { type, sectionId, itemId }
}

function hasCvValue(value) {
  if (typeof value === 'string') return Boolean(value.trim())
  if (!value || typeof value !== 'object') return Boolean(value)
  if (Array.isArray(value)) return value.some(hasCvValue)
  if (Array.isArray(value.content)) return value.content.some((block) => hasCvValue(block.text) || hasCvValue(block.runs))
  return Object.entries(value).some(([key, entry]) => key !== 'item_id' && hasCvValue(entry))
}

function incompleteCvSections(document) {
  const content = document?.content_json || {}
  const personal = content.personal_info || {}
  const sectionHasContent = (sectionKey, fields) => {
    const section = content.sections?.find((candidate) => candidate.section_key === sectionKey && candidate.enabled !== false)
    return Boolean(section?.items?.some((item) => fields.some((field) => hasCvValue(item[field]))))
  }
  return [
    !hasCvValue(personal.headline) && 'Vị trí ứng tuyển',
    !sectionHasContent('summary', ['value', 'description']) && 'Mục tiêu nghề nghiệp',
    !sectionHasContent('education', ['degree', 'institution', 'name', 'title', 'value', 'description']) && 'Học vấn',
    !sectionHasContent('experience', ['role', 'company', 'name', 'title', 'value', 'description']) && 'Kinh nghiệm việc làm',
  ].filter(Boolean)
}

function ToolPanel({ title, children, onClose, fullHeight = false }) {
  return <section className={`grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white ${fullHeight ? 'h-full' : 'max-h-[calc(100vh-5.5rem)]'}`}>
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-slate-100 px-4">
      <h2 className="text-[15px] font-extrabold text-slate-800">{title}</h2>
      <button type="button" aria-label="Đóng bảng công cụ" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"><CloseOutlined /></button>
    </header>
    <div className="min-h-0 overflow-y-auto p-4">{children}</div>
  </section>
}

function CvWysiwygDraftEditor({ publicId }) {
  const { message, modal } = App.useApp()
  const editor = useCvDraftEditor(publicId)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const builderUi = useBuilderUi(isDesktop ? 0.8 : 0.48)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(true)
  const [editingTipOpen, setEditingTipOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [selection, setSelection] = useState(null)
  const [pendingFocus, setPendingFocus] = useState(null)
  const [activeDrag, setActiveDrag] = useState(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!pendingFocus) return
    const target = pendingFocus.itemId
      ? globalThis.document.querySelector(`[data-cv-item-id="${pendingFocus.sectionId}:${pendingFocus.itemId}"] [role="textbox"]`)
      : globalThis.document.getElementById(`cv-section-${pendingFocus.sectionId}`)
    if (!target) return
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    if (pendingFocus.itemId) target.focus()
    setPendingFocus(null)
  }, [editor.document, pendingFocus])

  useEffect(() => {
    if (!selection || !editor.document) return
    if (selection.sectionId === 'personal') return
    const section = editor.document.content_json.sections.find((candidate) => candidate.instance_id === selection.sectionId)
    if (!section) setSelection(null)
    else if (selection.itemId && !section.items.some((item) => item.item_id === selection.itemId)) setSelection({ sectionId: selection.sectionId, itemId: null })
  }, [editor.document, selection])

  if (editor.phase === 'loading' || !editor.document) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (!editor.cv) return <div className="mx-auto max-w-3xl px-4 py-12"><Alert type="error" showIcon title="Không thể tải CV" description="Hãy thử tải lại trang hoặc kiểm tra quyền truy cập của bạn." /></div>

  const { content_json: content } = editor.document
  const orderedSections = getOrderedSections(editor.document)
  const regions = editor.document.layout_json.regions
  const capabilities = getEditorCapabilities(editor.cv.template_capabilities)
  const isBlocked = editor.phase === 'conflict'
  const changeDocument = (updater, label, options) => editor.updateDocument(updater, label, options)
  const changeContent = (updater, label, options) => changeDocument((document) => ({ ...document, content_json: updater(document.content_json) }), label, options)
  const changeStyle = (patch) => changeDocument((document) => ({ ...document, style_json: updateStyle(document.style_json, patch) }), 'Đổi phong cách CV')
  const updateCollectionContent = (instanceId, updater, label) => changeDocument((document) => {
    const nextContent = updater(document.content_json)
    return syncItemOrder({ ...document, content_json: nextContent }, instanceId)
  }, label)
  const moveSectionToTargetRegion = (instanceId, targetRegionId, targetIndex) => changeDocument(
    (document) => moveSectionToRegion(document, instanceId, targetRegionId, targetIndex),
    'Di chuyển section',
  )
  const updatePersonal = (patch, uploadedAsset) => {
    if (uploadedAsset) editor.rememberAsset(uploadedAsset)
    changeContent((current) => updatePersonalInfo(current, patch), 'Cập nhật thông tin cá nhân', { coalesceKey: `personal:${Object.keys(patch).join(',')}` })
  }
  const updateInlineStyle = (styleId, marks) => changeContent((current) => updateInlineTextStyle(current, styleId, marks), 'Định dạng văn bản', { coalesceKey: `inline-style:${styleId}` })
  const selectContent = (nextSelection) => setSelection(nextSelection)
  const addCollectionItem = (instanceId, afterItemId = null) => {
    let itemId = null
    changeDocument((document) => {
      const nextContent = addItem(document.content_json, instanceId)
      itemId = nextContent.sections.find((section) => section.instance_id === instanceId)?.items.at(-1)?.item_id || null
      let next = syncItemOrder({ ...document, content_json: nextContent }, instanceId)
      if (afterItemId && itemId) {
        const section = next.content_json.sections.find((candidate) => candidate.instance_id === instanceId)
        const anchorIndex = getOrderedItems(next, section).findIndex((item) => item.item_id === afterItemId)
        if (anchorIndex >= 0) next = moveItemToIndexInLayout(next, instanceId, itemId, anchorIndex + 1)
      }
      return next
    }, 'Thêm item')
    if (itemId) {
      selectContent({ sectionId: instanceId, itemId })
      setPendingFocus({ sectionId: instanceId, itemId })
    }
  }
  const removeCollectionItem = (instanceId, itemId) => {
    const section = content.sections.find((candidate) => candidate.instance_id === instanceId)
    const item = section?.items.find((candidate) => candidate.item_id === itemId)
    const hasContent = item && Object.entries(item).some(([key, value]) => key !== 'item_id' && (typeof value === 'string' ? value.trim() : value?.content?.some((block) => block.text?.trim())))
    const remove = () => {
      updateCollectionContent(instanceId, (current) => removeItem(current, instanceId, itemId), 'Xóa item')
      if (selection?.itemId === itemId) setSelection({ sectionId: instanceId, itemId: null })
    }
    if (!hasContent) remove()
    else modal.confirm({ title: 'Xóa nội dung này?', content: 'Dữ liệu trong nội dung sẽ bị xóa. Bạn có thể dùng Hoàn tác ngay sau đó nếu cần.', okText: 'Xóa', cancelText: 'Giữ lại', okButtonProps: { danger: true }, onOk: remove })
  }

  const addSectionAndSelect = (sectionKey, title, placement = null) => {
    let instanceId = null
    let firstItemId = null
    const personalInfoBacked = getSectionDefinition(sectionKey)?.personalInfoBacked
    changeDocument((document) => {
      const knownIds = new Set(document.content_json.sections.map((section) => section.instance_id))
      let next = addSection(document, sectionKey)
      const added = next.content_json.sections.find((section) => !knownIds.has(section.instance_id))
      if (!added) return next
      instanceId = added.instance_id
      firstItemId = added.items?.[0]?.item_id || null
      if (title) next = renameSection(next, instanceId, title)
      if (placement?.regionId) {
        // Dropped straight onto the canvas or the layout mini-map.
        const region = next.layout_json.regions.find((candidate) => candidate.id === placement.regionId)
        if (region) next = moveSectionToRegion(next, instanceId, placement.regionId, placement.index ?? region.section_instance_ids.length)
        return next
      }
      // Personal-info blocks (avatar) keep their smart default position instead
      // of following the current selection down the page.
      const activeRegion = personalInfoBacked ? null : next.layout_json.regions.find((region) => region.section_instance_ids.includes(selection?.sectionId))
      if (activeRegion) {
        const activeIndex = activeRegion.section_instance_ids.indexOf(selection.sectionId)
        next = moveSectionToRegion(next, instanceId, activeRegion.id, activeIndex + 1)
      }
      return next
    }, title ? 'Thêm mục tùy chỉnh' : 'Thêm section')
    if (!instanceId) return
    selectContent({ sectionId: instanceId, itemId: firstItemId })
    setPendingFocus({ sectionId: instanceId, itemId: firstItemId })
  }

  // Where a dragged block should land: over a region drops at its end, over a
  // section (canvas or mini-map) drops at that section's slot.
  const dropTarget = (target) => {
    if (['region', 'mini-region'].includes(target.type)) {
      const region = regions.find((candidate) => candidate.id === target.sectionId)
      return region ? { regionId: region.id, index: region.section_instance_ids.length } : null
    }
    const region = regions.find((candidate) => (candidate.section_instance_ids || []).includes(target.sectionId))
    return region ? { regionId: region.id, index: region.section_instance_ids.indexOf(target.sectionId) } : null
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveDrag(null)
    if (!over || active.id === over.id) return
    const source = parseDndId(active.id)
    const target = parseDndId(over.id)
    if (source.type === 'new') {
      const placement = dropTarget(target)
      if (placement) addSectionAndSelect(source.sectionId, undefined, placement)
    } else if (['section', 'mini-section'].includes(source.type)) {
      const placement = dropTarget(target)
      if (placement) moveSectionToTargetRegion(source.sectionId, placement.regionId, placement.index)
    } else if (source.type === 'item' && target.type === 'item' && source.sectionId === target.sectionId) {
      const section = content.sections.find((candidate) => candidate.instance_id === source.sectionId)
      const targetIndex = getOrderedItems(editor.document, section).findIndex((item) => item.item_id === target.itemId)
      changeDocument((document) => moveItemToIndexInLayout(document, source.sectionId, source.itemId, targetIndex), 'Kéo item')
    }
  }

  const dragPreview = activeDrag && (() => {
    const source = parseDndId(activeDrag)
    if (source.type === 'new') return getSectionDisplayName(source.sectionId, content.locale)
    const section = content.sections.find((candidate) => candidate.instance_id === source.sectionId)
    if (['section', 'mini-section'].includes(source.type)) return section?.title || getSectionDisplayName(section?.section_key, content.locale) || 'Mục CV'
    const item = section?.items.find((candidate) => candidate.item_id === source.itemId)
    return item?.role || item?.name || item?.title || item?.value || 'Nội dung CV'
  })()

  const requestRemoveSection = (instanceId) => {
    const section = content.sections.find((candidate) => candidate.instance_id === instanceId)
    if (!section) return
    const hasContent = section.items.some((item) => Object.entries(item).some(([key, value]) => key !== 'item_id' && (typeof value === 'string' ? value.trim() : value?.content?.some((block) => block.text?.trim()))))
    const remove = () => {
      changeDocument((document) => removeSection(document, instanceId), 'Xóa section')
      if (selection?.sectionId === instanceId) setSelection(null)
    }
    if (!hasContent) remove()
    else modal.confirm({ title: `Xóa mục “${section.title}”?`, content: 'Toàn bộ nội dung trong mục sẽ bị xóa. Bạn có thể dùng Hoàn tác ngay sau đó nếu cần.', okText: 'Xóa mục', cancelText: 'Giữ lại', okButtonProps: { danger: true }, onOk: remove })
  }

  const uploadAvatar = async (file) => {
    try {
      const uploaded = await uploadCvAsset(file)
      editor.rememberAsset(uploaded)
      message.success('Đã tải ảnh. Hãy căn chỉnh vùng hiển thị.')
      return uploaded
    } catch {
      message.error('Không thể tải ảnh đại diện')
      return null
    }
  }

  const locateSection = (instanceId) => {
    globalThis.document.getElementById(`cv-section-${instanceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    selectContent({ sectionId: instanceId, itemId: null })
  }

  const panelByTool = {
    design: <DesignFontPanel editor={editor} onStyle={changeStyle} onLocale={(locale) => changeContent((current) => changeContentLocale(current, locale), 'Đổi ngôn ngữ CV')} />,
    sections: <AddSectionsPanel locale={content.locale} availableKeys={availableSectionKeys(content)} sections={orderedSections} onAdd={(sectionKey) => addSectionAndSelect(sectionKey)} onAddCustom={(title) => addSectionAndSelect('custom', title)} onLocate={locateSection} />,
    layout: <LayoutPanel regions={regions} capabilities={capabilities} sections={orderedSections} onLocate={locateSection} pageMargin={Number(editor.document.layout_json.page?.margin_mm) || 8} onPageMarginChange={(margin_mm) => changeDocument((document) => ({ ...document, layout_json: { ...document.layout_json, page: { ...document.layout_json.page, margin_mm } } }), 'Đổi lề trang', { coalesceKey: 'page-margin' })} onResize={(regionId, width) => changeDocument((document) => resizeRegionPair(document, regionId, width, capabilities), 'Đổi tỷ lệ cột')} />,
    templates: <TemplateSwitcher currentTemplatePublicId={editor.cv.template_public_id} locale={content.locale} currentSections={content.sections} disabled={isBlocked || editor.phase === 'saving'} onSwitch={editor.switchTemplate} />,
    suggest: <AiSuggestPanel />,
    samples: <SampleLibraryPanel locale={content.locale} disabled={isBlocked || editor.phase === 'saving'} onApply={editor.applySample} />,
  }
  const activeTitle = BUILDER_TOOLS.find((tool) => tool.key === builderUi.activeTool)?.label
  const activePanel = <ToolPanel fullHeight={!isDesktop} title={activeTitle} onClose={() => isDesktop ? setDesktopPanelOpen(false) : setMobilePanelOpen(false)}>{panelByTool[builderUi.activeTool]}</ToolPanel>
  const chooseTool = (tool) => {
    builderUi.setActiveTool(tool)
    if (isDesktop) setDesktopPanelOpen(true)
    else setMobilePanelOpen(true)
  }
  const persistCv = async () => {
    const saved = await editor.saveDraft()
    if (saved) message.success('Lưu CV thành công')
    else message.error('Không thể lưu CV. Vui lòng thử lại.')
    return saved
  }
  const saveCv = () => {
    const snapshot = editor.flushPendingEdits() || editor.document
    const personal = snapshot.content_json.personal_info || {}
    const requiredFields = [
      ['email', 'Email'],
      ['address', 'Địa chỉ'],
      ['phone', 'Số điện thoại'],
    ]
    const missingRequired = requiredFields.filter(([field]) => !hasCvValue(personal[field])).map(([, label]) => label)
    if (missingRequired.length) {
      modal.warning({
        title: 'Chưa thể lưu CV',
        content: <>Vui lòng nhập đầy đủ <strong>{missingRequired.join(', ')}</strong> trước khi lưu.</>,
        okText: 'Đã hiểu',
      })
      return
    }
    const validationErrors = validateCvDocument(snapshot)
    if (validationErrors.length) {
      modal.warning({
        title: 'Thông tin CV chưa hợp lệ',
        content: <ul className="list-disc pl-5">{validationErrors.map((validationError) => <li key={validationError}>{validationError}</li>)}</ul>,
        okText: 'Kiểm tra lại',
      })
      return
    }
    const incompleteSections = incompleteCvSections(snapshot)
    if (!incompleteSections.length) {
      persistCv()
      return
    }
    modal.confirm({
      title: 'Lưu ý',
      content: <p>Một số mục trong CV của bạn chưa có nội dung: <strong>{incompleteSections.join(', ')}</strong>. Bạn nhớ hoàn thiện đầy đủ trước khi ứng tuyển nhé. Khi xem hoặc tải xuống, các mục trống sẽ tự động được ẩn đi để CV luôn gọn gàng và đẹp mắt.</p>,
      cancelText: 'Hoàn thiện tiếp',
      okText: 'Lưu CV, tôi sẽ hoàn thiện sau',
      onOk: persistCv,
    })
  }

  return <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveDrag(active.id)} onDragCancel={() => setActiveDrag(null)} onDragEnd={handleDragEnd}><div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef0f3]">
    <BuilderTopBar editor={editor} onSave={saveCv} onPreview={() => { setPreviewDocument(editor.flushPendingEdits() || editor.document); setPreviewOpen(true) }} />
    {['failed', 'conflict'].includes(editor.phase) && <div className="z-30 border-b border-slate-200 bg-white px-4 py-2"><EditorSaveState phase={editor.phase} error={editor.error} savedAt={editor.savedAt} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} /></div>}
    <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
      {isDesktop && <><ToolSidebar activeTool={builderUi.activeTool} onChange={chooseTool} />{desktopPanelOpen && <aside className="mt-4 w-[22rem] shrink-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{activePanel}</aside>}</>}
      <main className="relative min-w-0 flex-1 overflow-auto px-4 py-5 pb-24 lg:px-8">
        {editingTipOpen && <div className="mx-auto mb-2 flex h-8 max-w-full items-center justify-center bg-emerald-100 px-3 text-center text-xs font-medium text-emerald-700" style={{ width: `${210 * builderUi.zoom}mm` }}><span className="truncate"><strong>Gợi ý:</strong> Bôi đen văn bản để chỉnh sửa cỡ chữ và định dạng!</span><button type="button" aria-label="Đóng gợi ý chỉnh sửa" onClick={() => setEditingTipOpen(false)} className="ml-auto flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-emerald-200 text-[10px] text-emerald-700"><CloseOutlined /></button></div>}
        <CvEditableCanvas
          editor={editor}
          zoom={builderUi.zoom}
          onMoveItemDirection={(instanceId, itemId, direction) => changeDocument((document) => moveItemInLayout(document, instanceId, itemId, direction), 'Đổi thứ tự item')}
          onMoveSectionDirection={(instanceId, direction) => changeDocument((document) => moveSection(document, instanceId, direction), 'Đổi thứ tự section')}
          onRenameSection={(instanceId, title) => changeDocument((document) => renameSection(document, instanceId, title), 'Đổi tiêu đề section', { coalesceKey: `section-title:${instanceId}` })}
          onItemChange={(instanceId, itemId, patch) => changeContent((current) => updateItem(current, instanceId, itemId, patch), 'Cập nhật item', { coalesceKey: `item:${instanceId}:${itemId}:${Object.keys(patch).join(',')}` })}
          onAddItem={addCollectionItem}
          onRemoveItem={removeCollectionItem}
          onRemoveSection={requestRemoveSection}
          onPersonalChange={updatePersonal}
          onInlineTextStyle={updateInlineStyle}
          selection={selection}
          onSelect={selectContent}
          onAvatarUpload={uploadAvatar}
        />
        <CanvasZoomControls zoom={builderUi.zoom} onIn={builderUi.zoomIn} onOut={builderUi.zoomOut} onFit={() => builderUi.fit(isDesktop ? 0.8 : 0.48)} />
      </main>
    </div>
    {!isDesktop && <div className="fixed inset-x-0 bottom-0 z-40"><ToolSidebar mobile activeTool={builderUi.activeTool} onChange={chooseTool} /></div>}
    <Drawer placement="bottom" size="large" title={activeTitle} open={!isDesktop && mobilePanelOpen} onClose={() => setMobilePanelOpen(false)} styles={{ body: { padding: 0 } }}>{activePanel}</Drawer>
    <Modal open={previewOpen} onCancel={() => setPreviewOpen(false)} afterClose={() => setPreviewDocument(null)} footer={null} width="min(96vw, 1000px)" title="Xem trước CV" styles={{ body: { maxHeight: '82vh', overflow: 'auto', background: '#e2e8f0', padding: 24 } }}><CvDocumentPreview document={previewDocument || editor.document} rendererKey={editor.cv.template_renderer_key || editor.cv.template_version} assets={editor.assets} /></Modal>
  </div><DragOverlay dropAnimation={null}>{dragPreview && <div className="flex max-w-64 items-center gap-2 rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-xl"><HolderOutlined className="text-emerald-600" /><span className="truncate">{dragPreview}</span></div>}</DragOverlay></DndContext>
}

export default function CvDraftEditor({ publicId }) {
  const { settings } = useSiteSettings()
  return settings.cv_builder_wysiwyg_enabled === false
    ? <CvLegacyDraftEditor publicId={publicId} />
    : <CvWysiwygDraftEditor publicId={publicId} />
}
