const REGION_LABELS = { header: 'Đầu trang', main: 'Cột chính', sidebar: 'Cột phụ', left: 'Cột trái', right: 'Cột phải' }

export function getRegionLabel(regionId) {
  return REGION_LABELS[regionId] || regionId
}
