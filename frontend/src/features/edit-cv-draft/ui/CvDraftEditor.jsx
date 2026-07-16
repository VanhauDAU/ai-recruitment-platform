import { CloseOutlined } from '@ant-design/icons'
import { Alert, Drawer, Modal, Skeleton } from 'antd'
import { useState } from 'react'
import {
  addItem,
  addSection,
  availableSectionKeys,
  changeContentLocale,
  CvDocumentPreview,
  getEditorCapabilities,
  getOrderedSections,
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
  updatePersonalInfo,
  updateStyle,
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
import TemplateSwitcher from './TemplateSwitcher'
import ToolSidebar from './ToolSidebar'

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
  const editor = useCvDraftEditor(publicId)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const builderUi = useBuilderUi(isDesktop ? 0.8 : 0.48)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(true)
  const [editingTipOpen, setEditingTipOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)

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
  const addCollectionItem = (instanceId) => updateCollectionContent(instanceId, (current) => addItem(current, instanceId), 'Thêm item')
  const removeCollectionItem = (instanceId, itemId) => updateCollectionContent(instanceId, (current) => removeItem(current, instanceId, itemId), 'Xóa item')

  const panelByTool = {
    design: <DesignFontPanel editor={editor} onStyle={changeStyle} onLocale={(locale) => changeContent((current) => changeContentLocale(current, locale), 'Đổi ngôn ngữ CV')} />,
    sections: <AddSectionsPanel locale={content.locale} availableKeys={availableSectionKeys(content)} sections={orderedSections} onAdd={(sectionKey) => changeDocument((document) => addSection(document, sectionKey), 'Thêm section')} onLocate={(instanceId) => globalThis.document.getElementById(`cv-section-${instanceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />,
    layout: <LayoutPanel regions={regions} capabilities={capabilities} sections={orderedSections} onResize={(regionId, width) => changeDocument((document) => resizeRegionPair(document, regionId, width, capabilities), 'Đổi tỷ lệ cột')} />,
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

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef0f3]">
    <BuilderTopBar editor={editor} onPreview={() => { editor.flushPendingEdits(); setPreviewOpen(true) }} />
    {editor.validationErrors.length > 0 && <Alert className="z-30 rounded-none" type="warning" showIcon title="Kiểm tra CV trước khi lưu" description={<ul className="list-disc pl-5">{editor.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>} />}
    {editor.lastVersion && <Alert className="z-30 rounded-none" type="success" showIcon title={editor.lastVersion.version_kind === 'published' ? `Đã xuất bản phiên bản ${editor.lastVersion.version_number}` : `Đã tạo phiên bản ${editor.lastVersion.version_number}`} />}
    <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
      {isDesktop && <><ToolSidebar activeTool={builderUi.activeTool} onChange={chooseTool} />{desktopPanelOpen && <aside className="mt-4 w-[22rem] shrink-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{activePanel}</aside>}</>}
      <main className="relative min-w-0 flex-1 overflow-auto px-4 py-5 pb-24 lg:px-8">
        {editingTipOpen && <div className="mx-auto mb-2 flex h-8 max-w-full items-center justify-center bg-emerald-100 px-3 text-center text-xs font-medium text-emerald-700" style={{ width: `${210 * builderUi.zoom}mm` }}><span className="truncate"><strong>Gợi ý:</strong> Bôi đen văn bản để chỉnh sửa cỡ chữ và định dạng!</span><button type="button" aria-label="Đóng gợi ý chỉnh sửa" onClick={() => setEditingTipOpen(false)} className="ml-auto flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-emerald-200 text-[10px] text-emerald-700"><CloseOutlined /></button></div>}
        <CvEditableCanvas
          editor={editor}
          zoom={builderUi.zoom}
          onMoveSection={moveSectionToTargetRegion}
          onMoveItem={(instanceId, itemId, targetIndex) => changeDocument((document) => moveItemToIndexInLayout(document, instanceId, itemId, targetIndex), 'Kéo item')}
          onMoveItemDirection={(instanceId, itemId, direction) => changeDocument((document) => moveItemInLayout(document, instanceId, itemId, direction), 'Đổi thứ tự item')}
          onMoveSectionDirection={(instanceId, direction) => changeDocument((document) => moveSection(document, instanceId, direction), 'Đổi thứ tự section')}
          onRenameSection={(instanceId, title) => changeDocument((document) => renameSection(document, instanceId, title), 'Đổi tiêu đề section', { coalesceKey: `section-title:${instanceId}` })}
          onItemChange={(instanceId, itemId, patch) => changeContent((current) => updateItem(current, instanceId, itemId, patch), 'Cập nhật item', { coalesceKey: `item:${instanceId}:${itemId}:${Object.keys(patch).join(',')}` })}
          onAddItem={addCollectionItem}
          onRemoveItem={removeCollectionItem}
          onRemoveSection={(instanceId) => changeDocument((document) => removeSection(document, instanceId), 'Xóa section')}
          onPersonalChange={updatePersonal}
        />
        <CanvasZoomControls zoom={builderUi.zoom} onIn={builderUi.zoomIn} onOut={builderUi.zoomOut} onFit={() => builderUi.fit(isDesktop ? 0.8 : 0.48)} />
      </main>
    </div>
    {!isDesktop && <div className="fixed inset-x-0 bottom-0 z-40"><ToolSidebar mobile activeTool={builderUi.activeTool} onChange={chooseTool} /></div>}
    <Drawer placement="bottom" size="large" title={activeTitle} open={!isDesktop && mobilePanelOpen} onClose={() => setMobilePanelOpen(false)} styles={{ body: { padding: 0 } }}>{activePanel}</Drawer>
    <Modal open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width="min(96vw, 1000px)" title="Xem trước CV" styles={{ body: { maxHeight: '82vh', overflow: 'auto', background: '#e2e8f0', padding: 24 } }}><CvDocumentPreview document={editor.document} rendererKey={editor.cv.template_renderer_key || editor.cv.template_version} assets={editor.assets} /></Modal>
  </div>
}

export default function CvDraftEditor({ publicId }) {
  const { settings } = useSiteSettings()
  return settings.cv_builder_wysiwyg_enabled === false
    ? <CvLegacyDraftEditor publicId={publicId} />
    : <CvWysiwygDraftEditor publicId={publicId} />
}
