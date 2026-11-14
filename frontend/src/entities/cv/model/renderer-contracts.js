import layouts from './cv-layouts.json'
import { getOrderedItems } from './layout'

// Registry layout dùng chung với backend (backend/apps/cv_templates/layouts.json;
// cv-layouts.test.js giữ hai bản giống nhau). Mọi layout render bằng một renderer
// chung nên thêm layout chỉ cần thêm dữ liệu, không thêm component.
export const DEFAULT_LAYOUT_KEY = 'single_column_v1'

export const RENDERER_CONTRACTS = Object.freeze(Object.fromEntries(
  Object.entries(layouts).map(([key, layout]) => [key, Object.freeze({ key, ...layout })]),
))

export function getRendererContract(rendererKey) {
  return RENDERER_CONTRACTS[rendererKey] || RENDERER_CONTRACTS[DEFAULT_LAYOUT_KEY]
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
    .filter((spec) => configuredRegions.has(spec.id))
    .map((spec) => {
      const region = configuredRegions.get(spec.id)
      const sections = (region.section_instance_ids || [])
        .map((instanceId) => byId.get(instanceId))
        .filter(Boolean)
      sections.forEach((section) => assignedIds.add(section.instance_id))
      return {
        id: spec.id,
        row: region.row ?? spec.row,
        widthPercent: region.width_percent ?? spec.width,
        tone: spec.tone,
        arrange: spec.arrange,
        sections,
      }
    })

  if (regions.length === 0) regions.push({ id: 'main', row: 0, widthPercent: 100, tone: 'plain', arrange: 'stack', sections: [] })
  const unassignedSections = content_json.sections
    .filter((section) => !assignedIds.has(section.instance_id) && !hiddenIds.has(section.instance_id))
    .map((section) => byId.get(section.instance_id))
  regions[0].sections.push(...unassignedSections)
  return { contract, regions }
}

function paginateMeasuredRegion(region, measurements, capacityOf) {
  const sectionHeights = measurements.sections || measurements
  const itemHeights = measurements.items || {}
  const pages = [[]]
  let used = 0
  const capacity = () => capacityOf(pages.length - 1)
  for (const section of region.sections) {
    const sectionHeight = Number(sectionHeights[section.instance_id])
    const measuredItems = section.items.map((item) => Number(itemHeights[`${section.instance_id}:${item.item_id}`]))
    const canSplitItems = section.items.length > 1 && measuredItems.every((height) => Number.isFinite(height) && height > 0)
    if (!canSplitItems) {
      const height = Number.isFinite(sectionHeight) && sectionHeight > 0 ? sectionHeight : Math.max(72, estimatedSectionHeight(section) * 14)
      if (pages.at(-1).length && used + height > capacity()) {
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
      if (segment.length && used + segmentHeight + itemHeight > capacity()) {
        pages.at(-1).push({ ...section, items: segment })
        used += segmentHeight
        pages.push([])
        used = 0
        segment = []
        segmentHeight = headingHeight
      } else if (!segment.length && pages.at(-1).length && used + segmentHeight + itemHeight > capacity()) {
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

// Nội dung chỉ chảy sang trang sau ở hàng cuối (thân CV). Các hàng phía trên
// (header) chỉ nằm ở trang 1 và chiếm `firstPageReserved` của sức chứa trang 1.
export function paginateMeasuredProjection(projection, measurements = {}, capacity = {}) {
  const pageCapacity = capacity.page || 900
  const reserved = capacity.firstPageReserved || 0
  const bodyRow = Math.max(...projection.regions.map((region) => region.row ?? 0))
  const capacityOf = (pageIndex) => pageCapacity - (pageIndex === 0 ? reserved : 0)
  const regionPages = projection.regions.map((region) => ((region.row ?? 0) < bodyRow
    ? [region.sections]
    : paginateMeasuredRegion(region, measurements, capacityOf)))
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
