import { SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Select, Skeleton } from 'antd'
import {
  addExperience,
  CvDocumentPreview,
  getSection,
  removeExperience,
  richTextToText,
  updateExperience,
  updatePersonalInfo,
  updateSkills,
  updateStyle,
  updateSummary,
} from '@/entities/cv'
import useCvDraftEditor from '../model/use-cv-draft-editor'
import EditorSaveState from './EditorSaveState'
import ExperienceForm from './ExperienceForm'
import PersonalInfoForm from './PersonalInfoForm'
import SkillsForm from './SkillsForm'
import SummaryForm from './SummaryForm'

const FONT_OPTIONS = ['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'].map((font) => ({ value: font, label: font }))

export default function CvDraftEditor({ publicId }) {
  const editor = useCvDraftEditor(publicId)
  if (editor.phase === 'loading' || !editor.document) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton active paragraph={{ rows: 12 }} /></div>
  if (!editor.cv) return <div className="mx-auto max-w-3xl px-4 py-12"><Alert type="error" showIcon title="Không thể tải CV" description="Hãy thử tải lại trang hoặc kiểm tra quyền truy cập của bạn." /></div>

  const { content_json: content, style_json: style } = editor.document
  const summary = getSection(content, 'summary')
  const experience = getSection(content, 'experience')
  const skills = getSection(content, 'skills')
  const changeContent = (updater) => editor.updateDocument((document) => ({ ...document, content_json: updater(document.content_json) }))
  const changeStyle = (patch) => editor.updateDocument((document) => ({ ...document, style_json: updateStyle(document.style_json, patch) }))

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <main className="mx-auto max-w-[1600px] px-4">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-[var(--brand-primary)]">CV Builder MVP</p><h1 className="text-2xl font-extrabold text-slate-900">{editor.cv.title}</h1></div><div className="flex flex-wrap items-center gap-3"><EditorSaveState phase={editor.phase} error={editor.error} onRetry={editor.retryAutosave} onReload={editor.reloadDraft} /><Button aria-label="Lưu phiên bản" type="primary" icon={<SaveOutlined />} loading={editor.phase === 'saving'} disabled={editor.phase === 'conflict'} onClick={editor.saveVersion}>Lưu phiên bản</Button></div></header>
        {editor.lastVersion && <Alert className="mb-4" type="success" showIcon title={`Đã tạo phiên bản ${editor.lastVersion.version_number}`} />}
        <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.85fr)_minmax(36rem,1.15fr)]">
          <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Phong cách</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium text-slate-700">Màu chủ đề</span><input aria-label="Màu chủ đề" type="color" value={style.theme_color} onChange={(event) => changeStyle({ theme_color: event.target.value.toUpperCase() })} className="h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1" /></label><label><span className="mb-1 block text-sm font-medium text-slate-700">Phông chữ</span><Select aria-label="Phông chữ" value={style.font_family} options={FONT_OPTIONS} onChange={(font_family) => changeStyle({ font_family })} className="w-full" /></label></div></section>
            <PersonalInfoForm personalInfo={content.personal_info} onChange={(patch) => changeContent((current) => updatePersonalInfo(current, patch))} />
            <SummaryForm value={summary.items.map((item) => item.value || richTextToText(item.description)).join('\n')} onChange={(value) => changeContent((current) => updateSummary(current, value))} />
            <ExperienceForm items={experience.items} onChange={(itemId, patch) => changeContent((current) => updateExperience(current, itemId, patch))} onAdd={() => changeContent(addExperience)} onRemove={(itemId) => changeContent((current) => removeExperience(current, itemId))} />
            <SkillsForm value={skills.items.map((item) => item.name || item.value).filter(Boolean).join(', ')} onChange={(value) => changeContent((current) => updateSkills(current, value))} />
          </div>
          <aside className="xl:sticky xl:top-4 xl:self-start"><p className="mb-2 text-sm font-semibold text-slate-600">Xem trước A4 · {editor.cv.template_renderer_key || editor.cv.template_version}</p><CvDocumentPreview document={editor.document} rendererKey={editor.cv.template_renderer_key || editor.cv.template_version} /></aside>
        </div>
      </main>
    </div>
  )
}
