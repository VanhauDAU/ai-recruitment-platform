const DEFAULT_THEME_COLOR = '#00A66A'

// Template chưa gán màu nào vẫn hiển thị được với màu thương hiệu.
const FALLBACK_COLOR = {
  public_id: 'default',
  slug: 'default',
  name: 'Màu mặc định',
  hex_code: DEFAULT_THEME_COLOR,
  thumbnail_url: '',
  preview_url: '',
  is_default: true,
}

export function templateColors(template) {
  if (Array.isArray(template?.colors) && template.colors.length) {
    return [...template.colors].sort((left, right) => Number(right.is_default) - Number(left.is_default))
  }
  return [FALLBACK_COLOR]
}

export function templatePreviewForColor(template, color) {
  return color?.preview_url || color?.thumbnail_url || template?.thumbnail_url || ''
}
