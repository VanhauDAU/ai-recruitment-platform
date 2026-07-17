import { getOrderedItems } from './layout'

export const RENDERER_CONTRACTS = Object.freeze({
  classic_single_column_v1: { key: 'classic_single_column_v1', regions: ['main'], columns: 1, rows: [['main']] },
  classic_two_column_v1: { key: 'classic_two_column_v1', regions: ['main', 'sidebar'], columns: 2, rows: [['main', 'sidebar']] },
  header_two_column_v1: { key: 'header_two_column_v1', regions: ['header', 'main', 'sidebar'], columns: 2, rows: [['header'], ['main', 'sidebar']] },
})

export function getRendererContract(rendererKey) {
  return RENDERER_CONTRACTS[rendererKey] || RENDERER_CONTRACTS.classic_single_column_v1
}

export function projectDocumentForRenderer({ content_json, layout_json }, rendererKey) {
  const contract = getRendererContract(rendererKey)
  const document = { content_json, layout_json }
  const byId = new Map(content_json.sections.map((section) => [
    section.instance_id,
    { ...section, items: getOrderedItems(document, section) },
  ]))
  const assignedIds = new Set()
  const hiddenIds = new Set(layout_json.hidden_section_instance_ids || [])
  const configuredRegions = new Map((layout_json.regions || []).map((region) => [region.id, region]))
  const regions = contract.regions
    .filter((regionKey) => configuredRegions.has(regionKey))
    .map((regionKey) => {
      const region = configuredRegions.get(regionKey)
      const sections = (region.section_instance_ids || [])
        .map((instanceId) => byId.get(instanceId))
        .filter(Boolean)
      sections.forEach((section) => assignedIds.add(section.instance_id))
      return { id: regionKey, row: region.row ?? 0, widthPercent: region.width_percent, sections }
    })

  if (regions.length === 0) regions.push({ id: 'main', widthPercent: 100, sections: [] })
  const unassignedSections = content_json.sections
    .filter((section) => !assignedIds.has(section.instance_id) && !hiddenIds.has(section.instance_id))
    .map((section) => byId.get(section.instance_id))
  regions[0].sections.push(...unassignedSections)
  return { contract, regions }
}

function paginateMeasuredRegion(region, measurements, pageCapacityPx) {
  const sectionHeights = measurements.sections || measurements
  const itemHeights = measurements.items || {}
  const pages = [[]]
  let used = 0
  for (const section of region.sections) {
    const sectionHeight = Number(sectionHeights[section.instance_id])
    const measuredItems = section.items.map((item) => Number(itemHeights[`${section.instance_id}:${item.item_id}`]))
    const canSplitItems = section.items.length > 1 && measuredItems.every((height) => Number.isFinite(height) && height > 0)
    if (!canSplitItems) {
      const height = Number.isFinite(sectionHeight) && sectionHeight > 0 ? sectionHeight : Math.max(72, estimatedSectionHeight(section) * 14)
      if (pages.at(-1).length && used + height > pageCapacityPx) {
        pages.push([])
        used = 0
      }
      pages.at(-1).push(section)
      used += height
      continue
    }

    const itemTotal = measuredItems.reduce((sum, height) => sum + height, 0)
    const headingHeight = Math.max(24, (Number.isFinite(sectionHeight) ? sectionHeight : itemTotal + 36) - itemTotal)
    let segment = []
    let segmentHeight = headingHeight
    for (let index = 0; index < section.items.length; index += 1) {
      const item = section.items[index]
      const itemHeight = measuredItems[index]
      if (segment.length && used + segmentHeight + itemHeight > pageCapacityPx) {
        pages.at(-1).push({ ...section, items: segment })
        used += segmentHeight
        pages.push([])
        used = 0
        segment = []
        segmentHeight = headingHeight
      } else if (!segment.length && pages.at(-1).length && used + segmentHeight + itemHeight > pageCapacityPx) {
        pages.push([])
        used = 0
      }
      segment.push(item)
      segmentHeight += itemHeight
    }
    if (segment.length) {
      pages.at(-1).push({ ...section, items: segment })
      used += segmentHeight
    }
  }
  return pages
}

export function paginateMeasuredProjection(projection, measurements = {}, pageCapacityPx = 900) {
  const regionPages = projection.regions.map((region) => {
    return paginateMeasuredRegion(region, measurements, pageCapacityPx)
  })
  const pageCount = Math.max(1, ...regionPages.map((pages) => pages.length))
  return Array.from({ length: pageCount }, (_, index) => ({
    number: index + 1,
    regions: projection.regions.map((region, regionIndex) => ({
      ...region,
      sections: regionPages[regionIndex][index] || [],
    })),
  }))
}

function estimatedSectionHeight(section) {
  const itemHeight = section.items.reduce((total, item) => {
    const descriptionLength = JSON.stringify(item.description || item.value || '').length
    return total + 3 + Math.ceil(descriptionLength / 90)
  }, 0)
  return 4 + itemHeight
}

function paginateRegion(region, pageCapacity) {
  const pages = [[]]
  let currentHeight = 0
  for (const section of region.sections) {
    const height = estimatedSectionHeight(section)
    if (pages.at(-1).length && currentHeight + height > pageCapacity) {
      pages.push([])
      currentHeight = 0
    }
    pages.at(-1).push(section)
    currentHeight += height
  }
  return pages
}

// Presentation-only pagination: it keeps section and item references intact
// while exposing visual A4 page breaks before the browser's final layout pass.
export function paginateRendererProjection(projection, pageCapacity = 42) {
  const regionPages = projection.regions.map((region) => paginateRegion(region, pageCapacity))
  const pageCount = Math.max(1, ...regionPages.map((pages) => pages.length))
  return Array.from({ length: pageCount }, (_, index) => ({
    number: index + 1,
    regions: projection.regions.map((region, regionIndex) => ({
      ...region,
      sections: regionPages[regionIndex][index] || [],
    })),
  }))
}
