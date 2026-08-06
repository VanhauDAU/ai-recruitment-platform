export const ANNOUNCEMENT_SURFACES = Object.freeze({
  CANDIDATE: 'candidate',
  EMPLOYER_MARKETING: 'employer_marketing',
  EMPLOYER_WORKSPACE: 'employer_workspace',
  ADMIN_WORKSPACE: 'admin_workspace',
})

export const ANNOUNCEMENT_KINDS = Object.freeze({
  CRITICAL: 'critical',
  SECURITY: 'security',
  COMPLIANCE: 'compliance',
  WARNING: 'warning',
  MAINTENANCE: 'maintenance',
  INFO: 'info',
  SUCCESS: 'success',
  EVENT: 'event',
  FEATURE: 'feature',
})

export const ANNOUNCEMENT_ICONS = Object.freeze({
  ALERT_TRIANGLE: 'alert-triangle',
  BELL: 'bell',
  CHECK_CIRCLE: 'check-circle',
  INFO: 'info',
  LOCK: 'lock',
  MEGAPHONE: 'megaphone',
  SHIELD: 'shield',
  SPARKLES: 'sparkles',
  WRENCH: 'wrench',
})

export const ANNOUNCEMENT_ANIMATIONS = Object.freeze({
  SLIDE: 'slide',
  FADE: 'fade',
  STATIC: 'static',
})

export const ANNOUNCEMENT_DISMISS_MODES = Object.freeze({
  LOCKED: 'locked',
  CLOSE: 'close',
  SNOOZE: 'snooze',
})

export const ANNOUNCEMENT_THEME_MODES = Object.freeze({
  KIND: 'kind',
  PRESET: 'preset',
  CUSTOM: 'custom',
})

export const ANNOUNCEMENT_THEME_PRESETS = Object.freeze({
  BRAND: 'brand',
  EMERALD: 'emerald',
  AMBER: 'amber',
  ROSE: 'rose',
  VIOLET: 'violet',
  SLATE: 'slate',
  OCEAN: 'ocean',
})

export const ANNOUNCEMENT_BG_FITS = Object.freeze({
  COVER: 'cover',
  REPEAT_X: 'repeat-x',
  CONTAIN: 'contain',
})

export const ANNOUNCEMENT_BG_POSITIONS = Object.freeze({
  CENTER: 'center',
  TOP: 'top',
  BOTTOM: 'bottom',
})

export const ANNOUNCEMENT_BG_OVERLAYS = Object.freeze({
  NONE: 'none',
  LIGHT: 'light',
  DARK: 'dark',
})

/** Token màu dùng chung preview admin + runtime strip (AN-V). */
export const ANNOUNCEMENT_PRESET_TOKENS = Object.freeze({
  brand: { accent: '#0f766e', bgFrom: '#ecfdf5', bgTo: '#f0fdfa', fg: '#134e4a' },
  emerald: { accent: '#059669', bgFrom: '#ecfdf5', bgTo: '#d1fae5', fg: '#065f46' },
  amber: { accent: '#d97706', bgFrom: '#fffbeb', bgTo: '#fef3c7', fg: '#78350f' },
  rose: { accent: '#e11d48', bgFrom: '#fff1f2', bgTo: '#ffe4e6', fg: '#881337' },
  violet: { accent: '#7c3aed', bgFrom: '#f5f3ff', bgTo: '#ede9fe', fg: '#4c1d95' },
  slate: { accent: '#475569', bgFrom: '#f8fafc', bgTo: '#e2e8f0', fg: '#0f172a' },
  ocean: { accent: '#0284c7', bgFrom: '#f0f9ff', bgTo: '#e0f2fe', fg: '#0c4a6e' },
})

export const ANNOUNCEMENT_KIND_TOKENS = Object.freeze({
  critical: { accent: '#dc2626', bgFrom: '#fff1f2', bgTo: '#fff7ed', fg: '#881337' },
  security: { accent: '#b45309', bgFrom: '#fffbeb', bgTo: '#fff7ed', fg: '#78350f' },
  compliance: { accent: '#c2410c', bgFrom: '#fff7ed', bgTo: '#fffbeb', fg: '#7c2d12' },
  warning: { accent: '#dc2626', bgFrom: '#fff1f2', bgTo: '#fff7ed', fg: '#881337' },
  maintenance: { accent: '#c2410c', bgFrom: '#fff7ed', bgTo: '#fffbeb', fg: '#7c2d12' },
  info: { accent: '#0f766e', bgFrom: '#ecfdf5', bgTo: '#f0fdfa', fg: '#134e4a' },
  success: { accent: '#15803d', bgFrom: '#f0fdf4', bgTo: '#ecfdf5', fg: '#14532d' },
  event: { accent: '#6d28d9', bgFrom: '#f5f3ff', bgTo: '#faf5ff', fg: '#4c1d95' },
  feature: { accent: '#6d28d9', bgFrom: '#f5f3ff', bgTo: '#faf5ff', fg: '#4c1d95' },
})

export function resolveAnnouncementThemeTokens(values = {}) {
  const mode = values.theme_mode || ANNOUNCEMENT_THEME_MODES.KIND
  if (mode === ANNOUNCEMENT_THEME_MODES.CUSTOM) {
    const fallback = ANNOUNCEMENT_KIND_TOKENS[values.kind] || ANNOUNCEMENT_PRESET_TOKENS.brand
    return {
      accent: values.color_accent || fallback.accent,
      bgFrom: values.color_bg_from || fallback.bgFrom,
      bgTo: values.color_bg_to || fallback.bgTo,
      fg: values.color_fg || fallback.fg,
    }
  }
  if (mode === ANNOUNCEMENT_THEME_MODES.PRESET) {
    return ANNOUNCEMENT_PRESET_TOKENS[values.theme_preset] || ANNOUNCEMENT_PRESET_TOKENS.brand
  }
  return ANNOUNCEMENT_KIND_TOKENS[values.kind] || ANNOUNCEMENT_PRESET_TOKENS.brand
}
