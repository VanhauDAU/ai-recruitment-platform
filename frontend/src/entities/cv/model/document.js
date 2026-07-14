import { getSectionDefinition } from './section-registry'

const BASIC_SECTION_DEFINITIONS = ['summary', 'experience', 'skills'].map((sectionKey) => ({
  section_key: sectionKey,
  title: getSectionDefinition(sectionKey).displayName,
  preferredRegion: getSectionDefinition(sectionKey).preferredRegion,
}))

export const BASIC_EDITOR_SECTION_KEYS = Object.freeze(BASIC_SECTION_DEFINITIONS.map((section) => section.section_key))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sectionByKey(content, key) {
  return content.sections.find((section) => section.section_key === key)
}

function nextId(content, prefix) {
  const knownIds = new Set(content.sections.flatMap((section) => [
    section.instance_id,
    ...section.items.map((item) => item.item_id),
  ]))
  let number = 1
  while (knownIds.has(`${prefix}_${number}`)) number += 1
  return `${prefix}_${number}`
}

function emptySection(content, definition) {
  const itemId = nextId(content, `${definition.section_key}_item`)
  const item = definition.section_key === 'experience'
    ? { item_id: itemId, role: '', company: '', start_date: null, end_date: null, description: richText('') }
    : definition.section_key === 'skills'
      ? { item_id: itemId, name: '' }
      : { item_id: itemId, value: '' }
  return {
    instance_id: nextId(content, definition.section_key),
    section_key: definition.section_key,
    title: definition.title,
    enabled: true,
    items: [item],
  }
}

function ensureLayoutReferences(content, layout) {
  const nextLayout = clone(layout)
  const regions = nextLayout?.regions
  if (!Array.isArray(regions) || regions.length === 0) return nextLayout
  const assigned = new Set(regions.flatMap((region) => region.section_instance_ids || []))
  const fallbackRegion = regions[0]
  fallbackRegion.section_instance_ids ||= []
  for (const section of content.sections) {
    if (BASIC_EDITOR_SECTION_KEYS.includes(section.section_key) && !assigned.has(section.instance_id)) {
      const preferredRegion = BASIC_SECTION_DEFINITIONS.find((definition) => definition.section_key === section.section_key)?.preferredRegion
      const targetRegion = regions.find((region) => region.id === preferredRegion) || fallbackRegion
      targetRegion.section_instance_ids ||= []
      targetRegion.section_instance_ids.push(section.instance_id)
    }
  }
  return nextLayout
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
  const content_json = clone(document.content_json)
  for (const definition of BASIC_SECTION_DEFINITIONS) {
    if (!sectionByKey(content_json, definition.section_key)) {
      content_json.sections.push(emptySection(content_json, definition))
    }
  }
  return {
    ...document,
    content_json,
    layout_json: ensureLayoutReferences(content_json, document.layout_json),
    style_json: clone(document.style_json),
  }
}

export function getSection(content, sectionKey) {
  return sectionByKey(content, sectionKey)
}

export function updatePersonalInfo(content, patch) {
  const next = clone(content)
  next.personal_info = { ...next.personal_info, ...patch }
  return next
}

export function updateSummary(content, value) {
  const next = clone(content)
  const section = sectionByKey(next, 'summary')
  section.items[0] = { ...section.items[0], value }
  return next
}

export function updateExperience(content, itemId, patch) {
  const next = clone(content)
  const section = sectionByKey(next, 'experience')
  section.items = section.items.map((item) => item.item_id === itemId ? { ...item, ...patch } : item)
  return next
}

export function addExperience(content) {
  const next = clone(content)
  const section = sectionByKey(next, 'experience')
  section.items.push({
    item_id: nextId(next, 'experience_item'),
    role: '', company: '', start_date: null, end_date: null, description: richText(''),
  })
  return next
}

export function removeExperience(content, itemId) {
  const next = clone(content)
  const section = sectionByKey(next, 'experience')
  if (section.items.length > 1) section.items = section.items.filter((item) => item.item_id !== itemId)
  return next
}

export function updateSkills(content, value) {
  const next = clone(content)
  const section = sectionByKey(next, 'skills')
  const names = value.split(',').map((name) => name.trim()).filter(Boolean)
  section.items = (names.length ? names : ['']).map((name, index) => ({
    item_id: section.items[index]?.item_id || nextId(next, `skills_item_${index + 1}`),
    name,
  }))
  return next
}

export function updateStyle(style, patch) {
  return { ...clone(style), ...patch }
}
