import { m } from '@/shared/config/i18n'

export const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Giá trị ngắn gọn để hiển thị (hộp xác nhận, lịch sử, mặc định). */
export function formatSettingValue(setting, value) {
  if (setting?.value_type === 'boolean' || typeof value === 'boolean') {
    return value ? m.admin_settings_value_on() : m.admin_settings_value_off()
  }
  if (value === '' || value == null || (Array.isArray(value) && !value.length)) {
    return m.admin_settings_value_empty()
  }
  if (typeof value === 'object') {
    const text = JSON.stringify(value)
    return text.length > 80 ? `${text.slice(0, 77)}…` : text
  }
  return String(value)
}

/** `options.risky`: 'on' khi bật mới nguy hiểm, 'off' khi tắt mới nguy hiểm. */
export function isRiskyChange(setting, before, after) {
  const risky = setting.options?.risky
  if (risky === 'on') return after === true && before !== true
  if (risky === 'off') return after === false && before !== false
  return false
}

export function matchesQuery(setting, query) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [setting.label, setting.description, setting.key, setting.section]
    .some((text) => text?.toLocaleLowerCase().includes(needle))
}

function channel(hex, offset) {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Tỉ lệ tương phản WCAG của chữ trắng trên `hex` (#rrggbb); null nếu không phải hex. */
export function whiteContrastRatio(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null
  const luminance = 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
  return 1.05 / (luminance + 0.05)
}
