import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
} from './announcement.presentation'

const VALID_ANIMATIONS = new Set(Object.values(ANNOUNCEMENT_ANIMATIONS))
const VALID_DISMISS_MODES = new Set(Object.values(ANNOUNCEMENT_DISMISS_MODES))
const VALID_ICONS = new Set(Object.values(ANNOUNCEMENT_ICONS))
const VALID_KINDS = new Set(Object.values(ANNOUNCEMENT_KINDS))

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
