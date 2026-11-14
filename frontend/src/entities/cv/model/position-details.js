import { addSection, removeSection } from './document'

// Section `position_details` (CVT-3): trường riêng của vị trí, khung do backend
// dựng từ định nghĩa vị trí (`GET /v2/cv-position-details/`).
const isFilled = (value) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
const findSection = (document) => document.content_json.sections.find((section) => section.section_key === 'position_details')

// Đổi vị trí của CV: thay khung bằng khung của vị trí mới, giữ giá trị của các
// trường cùng `field_key`. Khung rỗng (vị trí không có trường riêng) gỡ section cũ.
export function applyPositionDetails(document, skeleton) {
  const current = findSection(document)
  if (!skeleton) return current ? removeSection(document, current.instance_id) : document
  const values = Object.fromEntries((current?.items || []).filter((item) => isFilled(item.value)).map((item) => [item.field_key, item.value]))
  const next = current ? structuredClone(document) : addSection(document, 'position_details')
  const section = findSection(next)
  section.title = skeleton.title
  section.items = skeleton.items.map((item) => (item.field_key in values ? { ...item, value: values[item.field_key] } : item))
  return next
}

export function formatPositionValue(item) {
  if (Array.isArray(item.value)) return item.value.join(', ')
  return isFilled(item.value) ? String(item.value) : ''
}
