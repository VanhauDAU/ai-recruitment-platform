import { Button, Drawer, Input, Select } from 'antd'
import { useState } from 'react'
import { FittedCvPreview, getSectionDisplayName } from '@/entities/cv'
import { sampleDocument } from '../model/catalog'

const TEXT_FIELDS = ['role', 'company', 'name', 'degree', 'institution', 'title', 'issuer', 'organization', 'value', 'start_date', 'end_date']
const FIELD_LABELS = { role: 'Chức danh', company: 'Công ty', name: 'Tên', degree: 'Bằng cấp', institution: 'Trường', title: 'Tiêu đề', issuer: 'Đơn vị cấp', organization: 'Tổ chức', value: 'Nội dung', start_date: 'Từ (YYYY-MM)', end_date: 'Đến (YYYY-MM)' }
const linesOf = (description) => (description?.content || []).map((block) => block.text).join('\n')
const toRichText = (text, format) => ({ format: format || 'rich_text_v1', content: text.split('\n').filter((line) => line.trim()).map((line) => ({ type: 'bullet', text: line.trim() })) })

function ItemEditor({ section, item, onChange }) {
  if (section.section_key === 'position_details') {
    const choice = ['select', 'multi_select', 'tags'].includes(item.field_type)
    return <label className="block text-xs font-semibold text-slate-600">{item.label}
      {choice
        ? <Select className="mt-1 w-full" mode={item.field_type === 'select' ? undefined : item.field_type === 'tags' ? 'tags' : 'multiple'} allowClear value={item.value || (item.field_type === 'select' ? undefined : [])} options={(item.options || []).map((option) => ({ value: option, label: option }))} onChange={(value) => onChange({ value: value ?? '' })} />
        : <Input className="mt-1" value={item.value ?? ''} onChange={(event) => onChange({ value: item.field_type === 'number' && event.target.value !== '' ? Number(event.target.value) || item.value : event.target.value })} />}
    </label>
  }
  if (section.section_key === 'summary') return <Input.TextArea aria-label="Mục tiêu nghề nghiệp" autoSize={{ minRows: 2, maxRows: 6 }} value={item.value || ''} onChange={(event) => onChange({ value: event.target.value })} />
  return <div className="space-y-2">
    <div className="grid gap-2 sm:grid-cols-2">{TEXT_FIELDS.filter((field) => field in item && (typeof item[field] === 'string' || item[field] === null)).map((field) => <Input key={field} size="small" addonBefore={FIELD_LABELS[field]} value={item[field] || ''} onChange={(event) => onChange({ [field]: field.endsWith('_date') ? event.target.value || null : event.target.value })} />)}</div>
    {item.description && <Input.TextArea aria-label="Mô tả" autoSize={{ minRows: 2, maxRows: 8 }} value={linesOf(item.description)} onChange={(event) => onChange({ description: toRichText(event.target.value, item.description.format) })} placeholder="Mỗi dòng một ý" />}
  </div>
}

// Sửa nội dung gợi ý theo từng mục (không sửa JSON), xem trước cạnh bên. Bản đang
// dùng được sửa trực tiếp nên thay đổi đến ứng viên ngay khi lưu.
export default function SampleEditorDrawer({ sample, onClose, onSave, saving, readOnly = false }) {
  const [draft, setDraft] = useState(sample)
  if (!draft) return null
  const content = draft.content_json
  const update = (sectionIndex, patch, itemIndex) => {
    const next = structuredClone(content)
    const section = next.sections[sectionIndex]
    if (itemIndex === undefined) Object.assign(section, patch)
    else Object.assign(section.items[itemIndex], patch)
    setDraft({ ...draft, content_json: next })
  }
  return <Drawer open size="min(1280px, 100vw)" title={`${readOnly ? 'Xem' : 'Sửa'} nội dung gợi ý · ${draft.title}`} onClose={onClose} extra={!readOnly && <Button type="primary" loading={saving} onClick={() => onSave(draft)}>{draft.status === 'published' ? 'Lưu (áp dụng ngay)' : 'Lưu bản nháp'}</Button>}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <fieldset disabled={readOnly} className="min-w-0 space-y-4">
        <Input addonBefore="Tên nội dung" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <Input addonBefore="Chức danh" value={content.personal_info?.headline || ''} onChange={(event) => setDraft({ ...draft, content_json: { ...content, personal_info: { ...content.personal_info, headline: event.target.value } } })} />
        {content.sections.map((section, sectionIndex) => <section key={section.instance_id} className="rounded-lg border border-slate-200 p-3">
          <Input size="small" addonBefore={getSectionDisplayName(section.section_key, content.locale)} value={section.title} onChange={(event) => update(sectionIndex, { title: event.target.value })} />
          <div className="mt-3 space-y-3">{section.items.map((item, itemIndex) => <ItemEditor key={item.item_id} section={section} item={item} onChange={(patch) => update(sectionIndex, patch, itemIndex)} />)}</div>
        </section>)}
      </fieldset>
      <div className="hidden lg:block"><div className="sticky top-0 rounded-lg bg-slate-100 p-3"><FittedCvPreview document={sampleDocument(content)} rendererKey="single_column_v1" /></div></div>
    </div>
  </Drawer>
}
