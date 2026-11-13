import { Select } from 'antd'
import { getCvUiText } from '@/entities/cv'
import InlineText from './InlineText'

// Một trường riêng của vị trí (section `position_details`): nhãn cố định do vị trí
// quy định, ứng viên chỉ điền giá trị theo đúng kiểu mà backend kiểm tra.
const TEXT_LIMITS = { text: 200, long_text: 2000, url: 300 }
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const NUMBER = /^-?\d+(?:[.,]\d+)?$/

function parseValue(fieldType, text) {
  const value = text.trim()
  if (!value) return { value: fieldType === 'number' || fieldType === 'date' ? null : '' }
  if (fieldType === 'number') return NUMBER.test(value) ? { value: Number(value.replace(',', '.')) } : null
  if (fieldType === 'date') return YEAR_MONTH.test(value) ? { value } : null
  if (fieldType === 'url') return { value: (/^https?:\/\//i.test(value) ? value : `https://${value}`).slice(0, TEXT_LIMITS.url) }
  return { value: value.slice(0, TEXT_LIMITS[fieldType] || TEXT_LIMITS.text) }
}

export default function PositionDetailField({ item, locale, onChange, registerPendingEdit, defaultFontFamily }) {
  const ariaLabel = `${item.label} ${item.item_id}`
  const choice = ['select', 'multi_select', 'tags'].includes(item.field_type)
  const multiple = item.field_type !== 'select'
  return <div className="cv-editor-item mb-3" data-cv-item-id={item.item_id}>
    <div className="text-xs font-semibold text-slate-500">{item.label}</div>
    {choice
      ? <Select size="small" variant="borderless" aria-label={ariaLabel} mode={item.field_type === 'tags' ? 'tags' : multiple ? 'multiple' : undefined} allowClear value={multiple ? item.value || [] : item.value || undefined} placeholder={item.placeholder || getCvUiText('choose', locale)} options={(item.options || []).map((option) => ({ value: option, label: option }))} onChange={(value) => onChange({ value: multiple ? value : value ?? '' })} className="-mx-2 w-[calc(100%+1rem)]" />
      : <InlineText value={item.value === null || item.value === undefined ? '' : String(item.value)} placeholder={item.placeholder || getCvUiText('value', locale)} ariaLabel={ariaLabel} className="block w-full" onCommit={(text) => { const parsed = parseValue(item.field_type, text); if (parsed) onChange(parsed) }} registerPendingEdit={registerPendingEdit} defaultFontFamily={defaultFontFamily} />}
  </div>
}
