import { getSectionDefinition } from './section-registry'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function itemIds(section) {
  return (section.items || []).map((item) => item.item_id)
}

function configuredItemOrder(document, section) {
  const configured = document.layout_json.item_orders?.[section.instance_id]
  const knownIds = itemIds(section)
  if (!Array.isArray(configured)) return knownIds
  const known = new Set(knownIds)
  const ordered = configured.filter((itemId) => known.has(itemId))
  return [...ordered, ...knownIds.filter((itemId) => !ordered.includes(itemId))]
}

function setItemOrder(document, instanceId, order) {
  const next = clone(document)
  next.layout_json.item_orders ||= {}
  next.layout_json.item_orders[instanceId] = order
  return next
}

export function getEditorCapabilities(capabilities = {}) {
  const layout = capabilities.layout || {}
  const resize = layout.column_resize
  return {
    sectionDrag: layout.section_drag !== false,
    crossRegionDrag: layout.cross_region_drag !== false,
    itemDrag: layout.item_drag !== false,
    columnResize: resize !== false && resize?.enabled !== false,
    minColumnPercent: Number.isFinite(resize?.min_percent) ? resize.min_percent : 20,
    maxColumnPercent: Number.isFinite(resize?.max_percent) ? resize.max_percent : 80,
    draggableSectionKeys: Array.isArray(layout.draggable_section_keys) ? new Set(layout.draggable_section_keys) : null,
  }
}

export function canDragSection(section, capabilities) {
  const definition = getSectionDefinition(section.section_key)
  return capabilities.sectionDrag
    && definition?.draggable !== false
    && (!capabilities.draggableSectionKeys || capabilities.draggableSectionKeys.has(section.section_key))
}

export function canDragItems(section, capabilities) {
  return capabilities.itemDrag && getSectionDefinition(section.section_key)?.itemDraggable !== false
}

export function getOrderedItems(document, section) {
  const byId = new Map((section.items || []).map((item) => [item.item_id, item]))
  return configuredItemOrder(document, section).map((itemId) => byId.get(itemId)).filter(Boolean)
}

export function syncItemOrder(document, instanceId) {
  const section = document.content_json.sections.find((candidate) => candidate.instance_id === instanceId)
  if (!section) return document
  const knownIds = itemIds(section)
  const currentOrder = configuredItemOrder(document, section)
  if (currentOrder.length === knownIds.length && currentOrder.every((itemId, index) => itemId === knownIds[index])) {
    if (!document.layout_json.item_orders?.[instanceId]) return document
  }
  return setItemOrder(document, instanceId, currentOrder)
}

export function moveSectionToRegion(document, instanceId, targetRegionId, targetIndex) {
  const next = clone(document)
  const targetRegion = next.layout_json.regions.find((region) => region.id === targetRegionId)
  if (!targetRegion) return next
  let sourceRegion = null
  let sourceIndex = -1
  for (const region of next.layout_json.regions) {
    const index = (region.section_instance_ids || []).indexOf(instanceId)
    if (index >= 0) {
      sourceRegion = region
      sourceIndex = index
      region.section_instance_ids.splice(index, 1)
      break
    }
  }
  targetRegion.section_instance_ids ||= []
  const adjustedIndex = sourceRegion?.id === targetRegionId && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  targetRegion.section_instance_ids.splice(clamp(adjustedIndex, 0, targetRegion.section_instance_ids.length), 0, instanceId)
  return next
}

export function moveItemToIndexInLayout(document, instanceId, itemId, targetIndex) {
  const section = document.content_json.sections.find((candidate) => candidate.instance_id === instanceId)
  if (!section || !itemIds(section).includes(itemId)) return document
  const order = configuredItemOrder(document, section)
  const sourceIndex = order.indexOf(itemId)
  order.splice(sourceIndex, 1)
  const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  order.splice(clamp(adjustedIndex, 0, order.length), 0, itemId)
  return setItemOrder(document, instanceId, order)
}

export function moveItemInLayout(document, instanceId, itemId, direction) {
  const section = document.content_json.sections.find((candidate) => candidate.instance_id === instanceId)
  if (!section) return document
  const order = configuredItemOrder(document, section)
  const index = order.indexOf(itemId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return document
  ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
  return setItemOrder(document, instanceId, order)
}

export function resizeRegionPair(document, regionId, requestedWidth, capabilities) {
  const next = clone(document)
  const index = next.layout_json.regions.findIndex((region) => region.id === regionId)
  const primary = next.layout_json.regions[index]
  const row = primary?.row ?? 0
  const secondary = next.layout_json.regions.slice(index + 1).find((region) => (region.row ?? 0) === row)
  if (!primary || !secondary || !capabilities.columnResize) return next
  const pairTotal = primary.width_percent + secondary.width_percent
  const min = Math.max(capabilities.minColumnPercent, pairTotal - capabilities.maxColumnPercent)
  const max = Math.min(capabilities.maxColumnPercent, pairTotal - capabilities.minColumnPercent)
  const width = clamp(Number(requestedWidth), min, max)
  primary.width_percent = width
  secondary.width_percent = pairTotal - width
  return next
}
