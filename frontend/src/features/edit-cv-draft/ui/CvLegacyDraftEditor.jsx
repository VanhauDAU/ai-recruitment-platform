import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { Alert, Button, Select, Skeleton } from 'antd'
import {
  addItem,
  addSection,
  availableSectionKeys,
  canDragItems,
  CvDocumentPreview,
  getEditorCapabilities,
  getOrderedItems,
  getOrderedSections,
  getSection,
  moveItemInLayout,
  moveItemToIndexInLayout,
  moveSection,
  moveSectionToRegion,
  removeItem,
  removeSection,
  renameSection,
  resizeRegionPair,
  richTextToText,
  setSectionEnabled,
  syncItemOrder,
  updateItem,
  updatePersonalInfo,
  updateStyle,
  updateSummary,
} from '@/entities/cv'
import useCvDraftEditor from '../model/use-cv-draft-editor'
import CollectionSectionForm from './CollectionSectionForm'
import EditorHistoryControls from './EditorHistoryControls'
import EditorSaveState from './EditorSaveState'
import LayoutResizeControls from './LayoutResizeControls'
import PersonalInfoForm from './PersonalInfoForm'
import SectionManager from './SectionManager'
import SummaryForm from './SummaryForm'
import TemplateSwitcher from './TemplateSwitcher'

const FONT_OPTIONS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((font) => ({ value: font, label: font }))

export default function CvLegacyDraftEditor({ publicId }) {
  const editor = useCvDraftEditor(publicId)
  if (editor.phase === 'loading' || !editor.document) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (!editor.cv) return <div className="mx-auto max-w-3xl px-4 py-12"><Alert type="error" showIcon title="Không thể tải CV" /></div>

  const { content_json: content, style_json: style } = editor.document
  const summary = getSection(content, 'summary')
  const orderedSections = getOrderedSections(editor.document)
  const collectionSections = orderedSections.filter(({ section }) => !['summary', 'nameplate', 'contact', 'avatar'].includes(section.section_key))
  const regions = editor.document.layout_json.regions
  const capabilities = getEditorCapabilities(editor.cv.template_capabilities)
  const changeDocument = (updater, label) => editor.updateDocument(updater, label)
  const changeContent = (updater, label) => changeDocument((document) => ({ ...document, content_json: updater(document.content_json) }), label)
  const updateCollection = (instanceId, updater, label) => changeDocument((document) => syncItemOrder({ ...document, content_json: updater(document.content_json) }, instanceId), label)
  const blocked = editor.phase === 'conflict'

  return <div className="min-h-screen bg-slate-50 py-6"><main className="mx-auto max-w-[1600px] px-4">
    <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Trình chỉnh sửa CV dự phòng</p><h1 className="text-2xl font-extrabold text-slate-900">{editor.cv.title}</h1></div><div className="flex flex-wrap items-center gap-3"><EditorHistoryControls canUndo={editor.canUndo} canRedo={editor.canRedo} disabled={blocked} onUndo={editor.undo} onRedo={editor.redo} /><EditorSaveState phase={editor.phase} error={editor.error} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} /><Button aria-label="Lưu phiên bản" type="primary" icon={<SaveOutlined />} disabled={blocked} loading={editor.phase === 'saving'} onClick={editor.saveVersion}>Lưu phiên bản</Button><Button aria-label="Xuất bản CV" icon={<SendOutlined />} disabled={blocked} onClick={editor.publishVersion}>Xuất bản</Button></div></header>
    {editor.validationErrors.length > 0 && <Alert className="mb-4" type="warning" showIcon title="Kiểm tra CV trước khi lưu" description={<ul className="list-disc pl-5">{editor.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>} />}
    {editor.lastVersion && <Alert className="mb-4" type="success" showIcon title={editor.lastVersion.version_kind === 'published' ? `Đã xuất bản phiên bản ${editor.lastVersion.version_number}` : `Đã tạo phiên bản ${editor.lastVersion.version_number}`} />}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(22rem,0.85fr)_minmax(36rem,1.15fr)]"><div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Phong cách</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium">Màu chủ đề</span><input aria-label="Màu chủ đề" type="color" value={style.theme_color} onChange={(event) => changeDocument((document) => ({ ...document, style_json: updateStyle(document.style_json, { theme_color: event.target.value.toUpperCase() }) }), 'Đổi màu CV')} className="h-10 w-full" /></label><label><span className="mb-1 block text-sm font-medium">Phông chữ</span><Select aria-label="Phông chữ" value={style.font_family} options={FONT_OPTIONS} onChange={(font_family) => changeDocument((document) => ({ ...document, style_json: updateStyle(document.style_json, { font_family }) }), 'Đổi font CV')} className="w-full" /></label></div></section>
      <TemplateSwitcher currentTemplatePublicId={editor.cv.template_public_id} locale={content.locale} disabled={blocked || editor.phase === 'saving'} onSwitch={editor.switchTemplate} />
      <LayoutResizeControls regions={regions} capabilities={capabilities} onResize={(regionId, width) => changeDocument((document) => resizeRegionPair(document, regionId, width, capabilities), 'Đổi tỷ lệ cột')} />
      <SectionManager regions={regions} sections={orderedSections} capabilities={capabilities} availableSectionKeys={availableSectionKeys(content)} onAdd={(key) => changeDocument((document) => addSection(document, key), 'Thêm section')} onDelete={(id) => changeDocument((document) => removeSection(document, id), 'Xóa section')} onToggle={(id, enabled) => changeDocument((document) => setSectionEnabled(document, id, enabled), 'Bật hoặc tắt section')} onRename={(id, title) => changeDocument((document) => renameSection(document, id, title), 'Đổi tiêu đề section')} onMove={(id, direction) => changeDocument((document) => moveSection(document, id, direction), 'Đổi thứ tự section')} onDrop={(id, regionId, index) => changeDocument((document) => moveSectionToRegion(document, id, regionId, index), 'Di chuyển section')} onRegionChange={(id, regionId) => changeDocument((document) => moveSectionToRegion(document, id, regionId, document.layout_json.regions.find((region) => region.id === regionId)?.section_instance_ids.length || 0), 'Chuyển vùng')} />
      <PersonalInfoForm personalInfo={content.personal_info} onChange={(patch) => changeContent((current) => updatePersonalInfo(current, patch), 'Cập nhật thông tin cá nhân')} />
      {summary && <SummaryForm value={summary.items.map((item) => item.value || richTextToText(item.description)).join('\n')} onChange={(value) => changeContent((current) => updateSummary(current, value), 'Cập nhật giới thiệu')} />}
      {collectionSections.map(({ section }) => { const items = getOrderedItems(editor.document, section); return <CollectionSectionForm key={section.instance_id} section={section} items={items} canDrag={canDragItems(section, capabilities)} onAdd={() => updateCollection(section.instance_id, (current) => addItem(current, section.instance_id), 'Thêm item')} onChange={(itemId, patch) => changeContent((current) => updateItem(current, section.instance_id, itemId, patch), 'Cập nhật item')} onMove={(itemId, direction) => changeDocument((document) => moveItemInLayout(document, section.instance_id, itemId, direction), 'Đổi thứ tự item')} onDrop={(itemId, index) => changeDocument((document) => moveItemToIndexInLayout(document, section.instance_id, itemId, index), 'Kéo item')} onRemove={(itemId) => updateCollection(section.instance_id, (current) => removeItem(current, section.instance_id, itemId), 'Xóa item')} /> })}
    </div><aside className="min-w-0 xl:sticky xl:top-4 xl:self-start"><p className="mb-2 text-sm font-semibold text-slate-600">Xem trước A4 · {editor.cv.template_renderer_key || editor.cv.template_version}</p><CvDocumentPreview document={editor.document} rendererKey={editor.cv.template_renderer_key || editor.cv.template_version} assets={editor.assets} /></aside></div>
  </main></div>
}
