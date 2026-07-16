const REGION_LABELS = { header: 'Đầu trang', main: 'Cột chính', sidebar: 'Cột phụ' }

export function getRegionLabel(regionId) {
  return REGION_LABELS[regionId] || regionId
}
