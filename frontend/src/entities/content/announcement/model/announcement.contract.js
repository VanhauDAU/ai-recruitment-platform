import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_BG_FITS,
  ANNOUNCEMENT_BG_OVERLAYS,
  ANNOUNCEMENT_BG_POSITIONS,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_THEME_MODES,
  ANNOUNCEMENT_THEME_PRESETS,
} from './announcement.presentation'

const VALID_ANIMATIONS = new Set(Object.values(ANNOUNCEMENT_ANIMATIONS))
const VALID_DISMISS_MODES = new Set(Object.values(ANNOUNCEMENT_DISMISS_MODES))
const VALID_ICONS = new Set(Object.values(ANNOUNCEMENT_ICONS))
const VALID_KINDS = new Set(Object.values(ANNOUNCEMENT_KINDS))
const VALID_THEME_MODES = new Set(Object.values(ANNOUNCEMENT_THEME_MODES))
const VALID_THEME_PRESETS = new Set(Object.values(ANNOUNCEMENT_THEME_PRESETS))
const VALID_BG_FITS = new Set(Object.values(ANNOUNCEMENT_BG_FITS))
const VALID_BG_POSITIONS = new Set(Object.values(ANNOUNCEMENT_BG_POSITIONS))
const VALID_BG_OVERLAYS = new Set(Object.values(ANNOUNCEMENT_BG_OVERLAYS))
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function text(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.trim() || fallback
}

function integerWithin(value, min, max, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback
}

export function normalizeAnnouncementUrl(value) {
  const url = text(value)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return { external: false, url }
  }
  if (url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      if (!parsed.username && !parsed.password) {
        return { external: true, url }
      }
    } catch {
      return null
    }
  }
  return null
}

function normalizeCta(value) {
  const label = text(value?.label)
  const safeUrl = normalizeAnnouncementUrl(value?.url)
  if (!label || !safeUrl) return null
  return { label, ...safeUrl }
}

function normalizeHex(value) {
  const color = text(value)
  return HEX_COLOR_RE.test(color) ? color.toUpperCase() : null
}

function normalizeImageUrl(value) {
  const url = text(value)
  if (!url) return ''
  if (url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      if (!parsed.username && !parsed.password) return url
    } catch {
      return ''
    }
  }
  // Public media path same-origin (e.g. /media/...)
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return ''
}

function normalizeTheme(value) {
  const mode = VALID_THEME_MODES.has(value?.mode)
    ? value.mode
    : ANNOUNCEMENT_THEME_MODES.KIND
  const preset = VALID_THEME_PRESETS.has(value?.preset) ? value.preset : null
  return {
    mode,
    preset: mode === ANNOUNCEMENT_THEME_MODES.PRESET ? preset : null,
    accent: mode === ANNOUNCEMENT_THEME_MODES.CUSTOM ? normalizeHex(value?.accent) : null,
    bgFrom: mode === ANNOUNCEMENT_THEME_MODES.CUSTOM ? normalizeHex(value?.bg_from ?? value?.bgFrom) : null,
    bgTo: mode === ANNOUNCEMENT_THEME_MODES.CUSTOM ? normalizeHex(value?.bg_to ?? value?.bgTo) : null,
    fg: mode === ANNOUNCEMENT_THEME_MODES.CUSTOM ? normalizeHex(value?.fg) : null,
  }
}

function normalizeBackground(value) {
  const imageUrl = normalizeImageUrl(value?.image_url ?? value?.imageUrl)
  const overlay = VALID_BG_OVERLAYS.has(value?.overlay)
    ? value.overlay
    : ANNOUNCEMENT_BG_OVERLAYS.NONE
  return {
    imageUrl,
    fit: VALID_BG_FITS.has(value?.fit) ? value.fit : ANNOUNCEMENT_BG_FITS.COVER,
    position: VALID_BG_POSITIONS.has(value?.position)
      ? value.position
      : ANNOUNCEMENT_BG_POSITIONS.CENTER,
    overlay,
  }
}

export function normalizeAnnouncement(value) {
  const publicId = text(value?.public_id)
  const message = text(value?.message, text(value?.message_vi))
  if (!publicId || !message) return null

  const kind = VALID_KINDS.has(value.kind) ? value.kind : ANNOUNCEMENT_KINDS.INFO
  const dismissMode = VALID_DISMISS_MODES.has(value.dismiss?.mode)
    ? value.dismiss.mode
    : ANNOUNCEMENT_DISMISS_MODES.LOCKED

  return {
    id: publicId,
    revision: integerWithin(value.revision, 1, Number.MAX_SAFE_INTEGER, 1),
    source: 'remote',
    kind,
    priorityTier: integerWithin(value.priority_tier, 1, 6, 6),
    priority: integerWithin(value.priority, 0, 1000, 50),
    message,
    badge: text(value.badge),
    icon: VALID_ICONS.has(value.icon) ? value.icon : ANNOUNCEMENT_ICONS.INFO,
    cta: normalizeCta(value.cta),
    animation: VALID_ANIMATIONS.has(value.animation)
      ? value.animation
      : ANNOUNCEMENT_ANIMATIONS.SLIDE,
    displaySeconds: integerWithin(value.display_seconds, 4, 15, 6),
    dismiss: {
      mode: dismissMode,
      snoozeSeconds: dismissMode === ANNOUNCEMENT_DISMISS_MODES.SNOOZE
        ? integerWithin(value.dismiss?.snooze_seconds, 60, Number.MAX_SAFE_INTEGER, 3600)
        : null,
      version: integerWithin(value.dismiss?.version, 1, Number.MAX_SAFE_INTEGER, 1),
    },
    theme: normalizeTheme(value.theme),
    background: normalizeBackground(value.background),
  }
}

export function normalizeAnnouncementFeed(value) {
  const remoteEnabled = value?.remote_enabled === true
  const items = remoteEnabled && Array.isArray(value?.items)
    ? value.items.map(normalizeAnnouncement).filter(Boolean)
    : []
  const transition = remoteEnabled ? text(value?.next_transition_at) : ''
  return {
    items,
    nextTransitionAt: Number.isNaN(Date.parse(transition)) ? null : transition,
    remoteEnabled,
  }
}
