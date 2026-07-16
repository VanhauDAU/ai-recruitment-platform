import { getSectionDefinition, getSectionDisplayName, SECTION_REGISTRY } from './section-registry'

const BASIC_EDITOR_SECTION_KEYS = Object.freeze(['summary', 'experience', 'skills'])
const ALLOWED_FONTS = new Set(['Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'])
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export const CV_FONT_STACKS = Object.freeze({
  Arial: 'Arial, Helvetica, sans-serif',
  Calibri: 'Calibri, Candara, "Segoe UI", sans-serif',
  Inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  Roboto: 'Roboto, Arial, Helvetica, sans-serif',
  'Source Sans Pro': '"Source Sans Pro", "Trebuchet MS", Arial, sans-serif',
})

export { BASIC_EDITOR_SECTION_KEYS }

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getAllIds(content) {
  return new Set(content.sections.flatMap((section) => [
    section.instance_id,
    ...(Array.isArray(section.items) ? section.items : []).map((item) => item.item_id),
  ]))
}

function nextId(content, prefix) {
  const knownIds = getAllIds(content)
  let number = 1
  while (knownIds.has(`${prefix}_${number}`)) number += 1
  return `${prefix}_${number}`
}

function defaultItem(content, sectionKey) {
  const item_id = nextId(content, `${sectionKey}_item`)
  if (sectionKey === 'experience') return { item_id, role: '', company: '', start_date: null, end_date: null, description: richText('') }
  if (sectionKey === 'education') return { item_id, degree: '', institution: '', start_date: null, end_date: null, description: richText('') }
  if (sectionKey === 'skills') return { item_id, name: '', level: '' }
  if (sectionKey === 'projects') return { item_id, name: '', role: '', description: richText('') }
  if (sectionKey === 'certifications') return { item_id, name: '', issuer: '', description: richText('') }
  return { item_id, name: '', value: '', description: richText('') }
}

function newSection(content, sectionKey) {
  const definition = getSectionDefinition(sectionKey)
  return {
    instance_id: nextId(content, sectionKey),
    section_key: sectionKey,
    title: getSectionDisplayName(sectionKey, content.locale),
    enabled: true,
    items: definition.initialItem === false ? [] : [defaultItem(content, sectionKey)],
  }
}

export function getCvFontStack(fontFamily) {
  return CV_FONT_STACKS[fontFamily] || CV_FONT_STACKS.Roboto
}

export function changeContentLocale(content, locale) {
  const next = clone(content)
  next.locale = locale
  next.sections = next.sections.map((section) => ({
    ...section,
    title: getSectionDisplayName(section.section_key, locale),
  }))
  return next
}

function sectionByKey(content, key) {
  return content.sections.find((section) => section.section_key === key)
}

function sectionById(content, instanceId) {
  return content.sections.find((section) => section.instance_id === instanceId)
}

function ensureSectionAssignment(layout, section) {
  const regions = layout.regions || []
  if (!regions.length || regions.some((region) => (region.section_instance_ids || []).includes(section.instance_id))) return
  const definition = getSectionDefinition(section.section_key)
  const target = regions.find((region) => region.id === definition?.preferredRegion) || regions[0]
  target.section_instance_ids ||= []
  target.section_instance_ids.push(section.instance_id)
}

function reorder(array, index, direction) {
  const target = index + direction
  if (index < 0 || target < 0 || target >= array.length) return array
  const next = [...array]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function richText(value) {
  return { format: 'rich_text_v1', content: value ? [{ type: 'paragraph', text: value }] : [] }
}

export function richTextToText(value) {
  if (typeof value === 'string') return value
  if (!value || !Array.isArray(value.content)) return ''
  return value.content.map((block) => block.text || '').join('\n')
}

export function ensureBasicEditorDocument(document) {
  const next = clone(document)
  for (const sectionKey of BASIC_EDITOR_SECTION_KEYS) {
    if (!sectionByKey(next.content_json, sectionKey)) {
      const section = newSection(next.content_json, sectionKey)
      next.content_json.sections.push(section)
      ensureSectionAssignment(next.layout_json, section)
    }
  }
  return next
}

export function getSection(content, sectionKey) {
  return sectionByKey(content, sectionKey)
}

export function getOrderedSections(document) {
  const sectionsById = new Map(document.content_json.sections.map((section) => [section.instance_id, section]))
  const seen = new Set()
  const ordered = (document.layout_json.regions || []).flatMap((region) => (region.section_instance_ids || []).flatMap((instanceId) => {
    const section = sectionsById.get(instanceId)
    if (!section) return []
    seen.add(instanceId)
    return [{ section, regionId: region.id }]
  }))
  return [...ordered, ...document.content_json.sections.filter((section) => !seen.has(section.instance_id)).map((section) => ({ section, regionId: null }))]
}

export function availableSectionKeys(content) {
  return Object.values(SECTION_REGISTRY)
    .filter((definition) => definition.allowMultiple || !sectionByKey(content, definition.key))
    .map((definition) => definition.key)
}

export function addSection(document, sectionKey) {
  const definition = getSectionDefinition(sectionKey)
  if (!definition) return document
  const next = clone(document)
  if (!definition.allowMultiple && sectionByKey(next.content_json, sectionKey)) return next
  const section = newSection(next.content_json, sectionKey)
  next.content_json.sections.push(section)
  ensureSectionAssignment(next.layout_json, section)
  return next
}

export function removeSection(document, instanceId) {
  const current = sectionById(document.content_json, instanceId)
  if (current && getSectionDefinition(current.section_key)?.deletable === false) return document
  const next = clone(document)
  next.content_json.sections = next.content_json.sections.filter((section) => section.instance_id !== instanceId)
  next.layout_json.regions.forEach((region) => {
    region.section_instance_ids = (region.section_instance_ids || []).filter((sectionId) => sectionId !== instanceId)
  })
  return next
}

export function setSectionEnabled(document, instanceId, enabled) {
  const next = clone(document)
  const section = sectionById(next.content_json, instanceId)
  if (!section) return next
  section.enabled = enabled
  if (enabled && section.items.length === 0 && getSectionDefinition(section.section_key)?.requiresItems) {
    section.items.push(defaultItem(next.content_json, section.section_key))
  }
  return next
}

export function renameSection(document, instanceId, title) {
  const next = clone(document)
  const section = sectionById(next.content_json, instanceId)
  if (section) section.title = title
  return next
}

export function moveSection(document, instanceId, direction) {
  const next = clone(document)
  const region = next.layout_json.regions.find((candidate) => (candidate.section_instance_ids || []).includes(instanceId))
  if (region) region.section_instance_ids = reorder(region.section_instance_ids, region.section_instance_ids.indexOf(instanceId), direction)
  return next
}

export function updatePersonalInfo(content, patch) {
  const next = clone(content)
  next.personal_info = { ...next.personal_info, ...patch }
  return next
}

export function updateSummary(content, value) {
  const next = clone(content)
  const section = sectionByKey(next, 'summary')
  if (section) section.items[0] = { ...section.items[0], value }
  return next
}

export function addItem(content, instanceId) {
  const next = clone(content)
  const section = sectionById(next, instanceId)
  if (section) section.items.push(defaultItem(next, section.section_key))
  return next
}

export function updateItem(content, instanceId, itemId, patch) {
  const next = clone(content)
  const section = sectionById(next, instanceId)
  if (section) section.items = section.items.map((item) => item.item_id === itemId ? { ...item, ...patch } : item)
  return next
}

export function removeItem(content, instanceId, itemId) {
  const next = clone(content)
  const section = sectionById(next, instanceId)
  if (!section) return next
  section.items = section.items.filter((item) => item.item_id !== itemId)
  if (section.items.length === 0 && getSectionDefinition(section.section_key)?.requiresItems) section.enabled = false
  return next
}

export function updateStyle(style, patch) {
  return { ...clone(style), ...patch }
}

export function validateCvDocument(document) {
  const errors = []
  const { content_json: content, layout_json: layout, style_json: style } = document || {}
  if (!content || !Array.isArray(content.sections)) return ['Nội dung CV không hợp lệ.']
  const instanceIds = new Set()
  const itemIds = new Set()
  const sectionCounts = {}
  for (const section of content.sections) {
    const definition = getSectionDefinition(section.section_key)
    if (!definition) { errors.push(`Section không được hỗ trợ: ${section.section_key || 'trống'}.`); continue }
    if (!section.instance_id || instanceIds.has(section.instance_id)) errors.push('Mỗi section phải có instance ID duy nhất.')
    instanceIds.add(section.instance_id)
    sectionCounts[section.section_key] = (sectionCounts[section.section_key] || 0) + 1
    if (!definition.allowMultiple && sectionCounts[section.section_key] > 1) errors.push(`${definition.displayName} chỉ được có một section.`)
    if (typeof section.enabled !== 'boolean') errors.push(`${section.title || definition.displayName} phải có trạng thái bật/tắt hợp lệ.`)
    if (!Array.isArray(section.items) || (section.enabled && definition.requiresItems && section.items.length === 0)) errors.push(`${section.title || definition.displayName} cần có ít nhất một item khi được bật.`)
    for (const item of section.items || []) {
      if (!item || typeof item !== 'object') { errors.push(`${section.title || definition.displayName} có item không hợp lệ.`); continue }
      if (!item.item_id || itemIds.has(item.item_id)) errors.push('Mỗi item phải có ID duy nhất.')
      itemIds.add(item.item_id)
      for (const key of ['start_date', 'end_date']) if (item[key] !== null && item[key] !== undefined && !YEAR_MONTH.test(item[key])) errors.push(`${section.title || definition.displayName}: ${key} phải có dạng YYYY-MM.`)
      if (item.description && !isValidRichText(item.description)) errors.push(`${section.title || definition.displayName} có rich text không hợp lệ.`)
    }
  }
  if (content.schema_version !== 1 || !content.locale) errors.push('Nội dung phải dùng schema version 1 và có locale.')
  if (!layout?.page || layout.schema_version !== 1 || layout.page.size !== 'A4' || typeof layout.page.margin_mm !== 'number' || !Array.isArray(layout.regions) || !layout.regions.length) errors.push('Layout phải có trang A4, margin số và ít nhất một vùng.')
  else {
    const assigned = new Set()
    const regionIds = new Set()
    const rowWidths = new Map()
    for (const region of layout.regions) {
      if (!region.id || regionIds.has(region.id) || !Number.isFinite(region.width_percent) || region.width_percent <= 0 || region.width_percent > 100) errors.push('Mỗi vùng layout phải có ID và độ rộng hợp lệ.')
      const row = region.row ?? 0
      if (!Number.isInteger(row) || row < 0) errors.push('Row của vùng layout phải là số nguyên không âm.')
      rowWidths.set(row, (rowWidths.get(row) || 0) + Number(region.width_percent || 0))
      regionIds.add(region.id)
      if (!Array.isArray(region.section_instance_ids)) { errors.push('Mỗi vùng layout phải có danh sách section.'); continue }
      for (const instanceId of region.section_instance_ids) {
        if (!instanceIds.has(instanceId) || assigned.has(instanceId)) errors.push('Layout chứa section reference không hợp lệ.')
        assigned.add(instanceId)
      }
    }
    if ([...rowWidths.values()].some((width) => Math.abs(width - 100) > 0.01)) errors.push('Tổng độ rộng các vùng trong mỗi hàng phải bằng 100%.')
    const hidden = layout.hidden_section_instance_ids || []
    if (!Array.isArray(hidden) || new Set(hidden).size !== hidden.length || hidden.some((instanceId) => !instanceIds.has(instanceId) || assigned.has(instanceId))) errors.push('Danh sách section ẩn không hợp lệ.')
    const itemOrders = layout.item_orders || {}
    if (typeof itemOrders !== 'object' || Array.isArray(itemOrders)) errors.push('Thứ tự item trong layout không hợp lệ.')
    else for (const [sectionId, order] of Object.entries(itemOrders)) {
      const section = content.sections.find((candidate) => candidate.instance_id === sectionId)
      const knownItemIds = new Set(section?.items?.map((item) => item.item_id) || [])
      if (!section || !Array.isArray(order) || order.length !== knownItemIds.size || new Set(order).size !== order.length || order.some((itemId) => !knownItemIds.has(itemId))) errors.push('Layout chứa thứ tự item không hợp lệ.')
    }
  }
  if (!style || style.schema_version !== 1 || !HEX_COLOR.test(style.theme_color || '') || !ALLOWED_FONTS.has(style.font_family) || typeof style.font_scale !== 'number' || style.font_scale < 0.8 || style.font_scale > 1.4 || typeof style.line_height !== 'number' || style.line_height < 1 || style.line_height > 2 || !style.section_overrides || typeof style.section_overrides !== 'object' || Array.isArray(style.section_overrides)) errors.push('Màu chủ đề, phông chữ hoặc style không hợp lệ.')
  return [...new Set(errors)]
}

function validMarks(marks = {}) {
  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) return false
  const allowed = new Set(['bold', 'italic', 'underline', 'font_family', 'font_size_pt', 'color'])
  if (Object.keys(marks).some((key) => !allowed.has(key))) return false
  if (['bold', 'italic', 'underline'].some((key) => key in marks && typeof marks[key] !== 'boolean')) return false
  if ('font_family' in marks && !ALLOWED_FONTS.has(marks.font_family)) return false
  if ('font_size_pt' in marks && (typeof marks.font_size_pt !== 'number' || marks.font_size_pt < 8 || marks.font_size_pt > 32)) return false
  return !('color' in marks) || HEX_COLOR.test(marks.color)
}

function isValidRichText(value) {
  if (!value || !Array.isArray(value.content) || !['rich_text_v1', 'rich_text_v2'].includes(value.format)) return false
  return value.content.every((block) => {
    if (!block || !['bullet', 'paragraph'].includes(block.type) || typeof block.text !== 'string' || block.text.includes('<') || block.text.includes('>')) return false
    if (value.format === 'rich_text_v1') return true
    return Array.isArray(block.runs)
      && block.runs.every((run) => run && typeof run.text === 'string' && validMarks(run.marks || {}))
      && block.runs.map((run) => run.text).join('') === block.text
  })
}
