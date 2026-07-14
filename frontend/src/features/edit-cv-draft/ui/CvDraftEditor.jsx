import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { Alert, Button, Select, Skeleton } from 'antd'
import {
  addItem,
  addSection,
  availableSectionKeys,
  CvDocumentPreview,
  getOrderedSections,
  getSection,
  moveItem,
  moveSection,
  removeItem,
  removeSection,
  renameSection,
  richTextToText,
  setSectionEnabled,
  updateItem,
  updatePersonalInfo,
  updateStyle,
  updateSummary,
} from '@/entities/cv'
import useCvDraftEditor from '../model/use-cv-draft-editor'
import CollectionSectionForm from './CollectionSectionForm'
import EditorSaveState from './EditorSaveState'
import PersonalInfoForm from './PersonalInfoForm'
import SectionManager from './SectionManager'
import SummaryForm from './SummaryForm'

const FONT_OPTIONS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((font) => ({ value: font, label: font }))

export default function CvDraftEditor({ publicId }) {
  const editor = useCvDraftEditor(publicId)
  if (editor.phase === 'loading' || !editor.document) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (!editor.cv) return <div className="mx-auto max-w-3xl px-4 py-12"><Alert type="error" showIcon title="Không thể tải CV" description="Hãy thử tải lại trang hoặc kiểm tra quyền truy cập của bạn." /></div>

  const { content_json: content, style_json: style } = editor.document
  const summary = getSection(content, 'summary')
  const orderedSections = getOrderedSections(editor.document)
  const collectionSections = orderedSections.filter(({ section }) => section.section_key !== 'summary')
  const changeDocument = (updater) => editor.updateDocument(updater)
  const changeContent = (updater) => changeDocument((document) => ({ ...document, content_json: updater(document.content_json) }))
  const changeStyle = (patch) => changeDocument((document) => ({ ...document, style_json: updateStyle(document.style_json, patch) }))
  const isBlocked = editor.phase === 'conflict'

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <main className="mx-auto max-w-[1600px] px-4">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-[var(--brand-primary)]">CV Builder Phase 2</p><h1 className="text-2xl font-extrabold text-slate-900">{editor.cv.title}</h1></div><div className="flex flex-wrap items-center gap-3"><EditorSaveState phase={editor.phase} error={editor.error} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} /><Button aria-label="Lưu phiên bản" type="primary" icon={<SaveOutlined />} loading={editor.phase === 'saving'} disabled={isBlocked} onClick={editor.saveVersion}>Lưu phiên bản</Button><Button aria-label="Xuất bản CV" icon={<SendOutlined />} disabled={isBlocked} onClick={editor.publishVersion}>Xuất bản</Button></div></header>
        {editor.validationErrors.length > 0 && <Alert className="mb-4" type="warning" showIcon title="Kiểm tra CV trước khi lưu" description={<ul className="list-disc pl-5">{editor.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>} />}
        {editor.lastVersion && <Alert className="mb-4" type="success" showIcon title={editor.lastVersion.version_kind === 'published' ? `Đã xuất bản phiên bản ${editor.lastVersion.version_number}` : `Đã tạo phiên bản ${editor.lastVersion.version_number}`} />}
        <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.85fr)_minmax(36rem,1.15fr)]">
          <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Phong cách</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium text-slate-700">Màu chủ đề</span><input aria-label="Màu chủ đề" type="color" value={style.theme_color} onChange={(event) => changeStyle({ theme_color: event.target.value.toUpperCase() })} className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1" /></label><label><span className="mb-1 block text-sm font-medium text-slate-700">Phông chữ</span><Select aria-label="Phông chữ" value={style.font_family} options={FONT_OPTIONS} onChange={(font_family) => changeStyle({ font_family })} className="w-full" /></label></div></section>
            <SectionManager sections={orderedSections} availableSectionKeys={availableSectionKeys(content)} onAdd={(sectionKey) => changeDocument((document) => addSection(document, sectionKey))} onDelete={(instanceId) => changeDocument((document) => removeSection(document, instanceId))} onToggle={(instanceId, enabled) => changeDocument((document) => setSectionEnabled(document, instanceId, enabled))} onRename={(instanceId, title) => changeDocument((document) => renameSection(document, instanceId, title))} onMove={(instanceId, direction) => changeDocument((document) => moveSection(document, instanceId, direction))} />
            <PersonalInfoForm personalInfo={content.personal_info} onChange={(patch) => changeContent((current) => updatePersonalInfo(current, patch))} />
            {summary && <SummaryForm value={summary.items.map((item) => item.value || richTextToText(item.description)).join('\n')} onChange={(value) => changeContent((current) => updateSummary(current, value))} />}
            {collectionSections.map(({ section }) => <CollectionSectionForm key={section.instance_id} section={section} onAdd={() => changeContent((current) => addItem(current, section.instance_id))} onChange={(itemId, patch) => changeContent((current) => updateItem(current, section.instance_id, itemId, patch))} onMove={(itemId, direction) => changeContent((current) => moveItem(current, section.instance_id, itemId, direction))} onRemove={(itemId) => changeContent((current) => removeItem(current, section.instance_id, itemId))} />)}
          </div>
          <aside className="xl:sticky xl:top-4 xl:self-start"><p className="mb-2 text-sm font-semibold text-slate-600">Xem trước A4 · {editor.cv.template_renderer_key || editor.cv.template_version}</p><CvDocumentPreview document={editor.document} rendererKey={editor.cv.template_renderer_key || editor.cv.template_version} /></aside>
        </div>
      </main>
    </div>
  )
}
