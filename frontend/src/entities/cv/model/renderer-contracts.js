export const RENDERER_CONTRACTS = Object.freeze({
  classic_single_column_v1: { key: 'classic_single_column_v1', regions: ['main'], columns: 1 },
  classic_two_column_v1: { key: 'classic_two_column_v1', regions: ['main', 'sidebar'], columns: 2 },
})

export function getRendererContract(rendererKey) {
  return RENDERER_CONTRACTS[rendererKey] || RENDERER_CONTRACTS.classic_single_column_v1
}

export function projectDocumentForRenderer({ content_json, layout_json }, rendererKey) {
  const contract = getRendererContract(rendererKey)
  const byId = new Map(content_json.sections.map((section) => [section.instance_id, section]))
  const assignedIds = new Set()
  const configuredRegions = new Map((layout_json.regions || []).map((region) => [region.id, region]))
  const regions = contract.regions
    .filter((regionKey) => configuredRegions.has(regionKey))
    .map((regionKey) => {
      const region = configuredRegions.get(regionKey)
      const sections = (region.section_instance_ids || [])
        .map((instanceId) => byId.get(instanceId))
        .filter(Boolean)
      sections.forEach((section) => assignedIds.add(section.instance_id))
      return { id: regionKey, widthPercent: region.width_percent, sections }
    })

  if (regions.length === 0) regions.push({ id: 'main', widthPercent: 100, sections: [] })
  const unassignedSections = content_json.sections.filter((section) => !assignedIds.has(section.instance_id))
  regions[0].sections.push(...unassignedSections)
  return { contract, regions }
}
