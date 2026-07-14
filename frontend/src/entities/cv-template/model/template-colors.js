const DEFAULT_THEME_COLOR = '#00A66A'

export function templateColors(template) {
  if (Array.isArray(template?.colors) && template.colors.length) {
    return [...template.colors].sort((left, right) => Number(right.is_default) - Number(left.is_default))
  }

  // Compatibility for an API node that has not run the color migration yet.
  const hexCode = template?.theme_color || DEFAULT_THEME_COLOR
  return [{
    public_id: `legacy-${hexCode}`,
    slug: 'default',
    name: 'Màu mặc định',
    hex_code: hexCode,
    thumbnail_url: template?.thumbnail_url || '',
    preview_url: template?.preview_url || template?.thumbnail_url || '',
    is_default: true,
  }]
}

export function templatePreviewForColor(template, color) {
  return color?.preview_url || color?.thumbnail_url || template?.preview_url || template?.thumbnail_url || ''
}
