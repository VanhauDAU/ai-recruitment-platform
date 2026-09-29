import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_BG_FITS,
  ANNOUNCEMENT_BG_OVERLAYS,
  ANNOUNCEMENT_BG_POSITIONS,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_SURFACES,
  ANNOUNCEMENT_THEME_MODES,
} from './announcement.presentation'

export const ANNOUNCEMENT_AUDIENCES = Object.freeze({
  GUEST: 'guest',
  AUTHENTICATED: 'authenticated',
})

export const ANNOUNCEMENT_ROLES = Object.freeze({
  CANDIDATE: 'candidate',
  EMPLOYER: 'employer',
  ADMIN: 'admin',
})

export const ANNOUNCEMENT_LIFECYCLE_STATES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
})

export const ANNOUNCEMENT_PRESENTATION_STATUSES = Object.freeze({
  ...ANNOUNCEMENT_LIFECYCLE_STATES,
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
})

export const ANNOUNCEMENT_PRIORITY_TIERS = Object.freeze({
  [ANNOUNCEMENT_KINDS.CRITICAL]: 1,
  [ANNOUNCEMENT_KINDS.SECURITY]: 2,
  [ANNOUNCEMENT_KINDS.COMPLIANCE]: 3,
  [ANNOUNCEMENT_KINDS.WARNING]: 4,
  [ANNOUNCEMENT_KINDS.MAINTENANCE]: 4,
  [ANNOUNCEMENT_KINDS.INFO]: 6,
  [ANNOUNCEMENT_KINDS.SUCCESS]: 6,
  [ANNOUNCEMENT_KINDS.EVENT]: 6,
  [ANNOUNCEMENT_KINDS.FEATURE]: 6,
})

export const DEFAULT_ADMIN_ANNOUNCEMENT_REVISION = Object.freeze({
  message_vi: '',
  message_en: '',
  badge_vi: '',
  badge_en: '',
  icon: ANNOUNCEMENT_ICONS.INFO,
  cta_label_vi: '',
  cta_label_en: '',
  cta_url: '',
  kind: ANNOUNCEMENT_KINDS.INFO,
  surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
  auth_audiences: [
    ANNOUNCEMENT_AUDIENCES.GUEST,
    ANNOUNCEMENT_AUDIENCES.AUTHENTICATED,
  ],
  roles: [],
  include_path_prefixes: [],
  exclude_path_prefixes: [],
  starts_at: null,
  ends_at: null,
  priority: 50,
  animation: ANNOUNCEMENT_ANIMATIONS.SLIDE,
  display_seconds: 6,
  dismiss_mode: ANNOUNCEMENT_DISMISS_MODES.CLOSE,
  snooze_seconds: null,
  theme_mode: ANNOUNCEMENT_THEME_MODES.KIND,
  theme_preset: '',
  color_accent: '',
  color_bg_from: '',
  color_bg_to: '',
  color_fg: '',
  background_image: '',
  background_image_url: '',
  background_fit: ANNOUNCEMENT_BG_FITS.COVER,
  background_position: ANNOUNCEMENT_BG_POSITIONS.CENTER,
  background_overlay: ANNOUNCEMENT_BG_OVERLAYS.NONE,
})

function text(value) {
  return typeof value === 'string' ? value : ''
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function actor(value) {
  if (!value || typeof value !== 'object') return null
  return {
    public_id: text(value.public_id),
    name: text(value.name),
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeAdminAnnouncementListItem(value = {}) {
  return {
    public_id: text(value.public_id),
    internal_name: text(value.internal_name),
    lifecycle_state: text(value.lifecycle_state),
    presentation_status: text(value.presentation_status),
    kind: text(value.kind),
    surfaces: list(value.surfaces),
    starts_at: value.starts_at || null,
    ends_at: value.ends_at || null,
    priority: value.priority == null ? null : number(value.priority),
    active_revision_number: value.active_revision_number ?? null,
    draft_revision_number: value.draft_revision_number ?? null,
    creator: actor(value.creator),
    publisher: actor(value.publisher),
    impressions: number(value.impressions),
    clicks: number(value.clicks),
    ctr: number(value.ctr),
    dismisses: number(value.dismisses),
    published_at: value.published_at || null,
    created_at: value.created_at || null,
    updated_at: value.updated_at || null,
  }
}

function normalizeRevision(value = {}) {
  const background = value.background && typeof value.background === 'object'
    ? value.background
    : {}
  return {
    ...DEFAULT_ADMIN_ANNOUNCEMENT_REVISION,
    ...value,
    number: number(value.number, 1),
    surfaces: list(value.surfaces),
    auth_audiences: list(value.auth_audiences),
    roles: list(value.roles),
    include_path_prefixes: list(value.include_path_prefixes),
    exclude_path_prefixes: list(value.exclude_path_prefixes),
    theme_mode: text(value.theme_mode) || ANNOUNCEMENT_THEME_MODES.KIND,
    theme_preset: text(value.theme_preset),
    color_accent: text(value.color_accent),
    color_bg_from: text(value.color_bg_from),
    color_bg_to: text(value.color_bg_to),
    color_fg: text(value.color_fg),
    background_image: text(value.background_image || background.image_storage_key),
    background_image_url: text(background.image_url || value.background_image_url),
    background_fit: text(value.background_fit || background.fit) || ANNOUNCEMENT_BG_FITS.COVER,
    background_position: text(value.background_position || background.position)
      || ANNOUNCEMENT_BG_POSITIONS.CENTER,
    background_overlay: text(value.background_overlay || background.overlay)
      || ANNOUNCEMENT_BG_OVERLAYS.NONE,
    creator: actor(value.creator),
    is_active: Boolean(value.is_active),
    published_at: value.published_at || null,
    created_at: value.created_at || null,
  }
}

function normalizeAuditEvent(value = {}) {
  return {
    public_id: text(value.public_id),
    action: text(value.action),
    source: text(value.source),
    actor: actor(value.actor),
    payload: value.payload && typeof value.payload === 'object' ? value.payload : {},
    created_at: value.created_at || null,
  }
}

export function normalizeAdminAnnouncementDetail(value = {}) {
  return {
    ...normalizeAdminAnnouncementListItem(value),
    revision_token: number(value.revision_token, 1),
    dismissal_version: number(value.dismissal_version, 1),
    paused_at: value.paused_at || null,
    archived_at: value.archived_at || null,
    revisions: list(value.revisions).map(normalizeRevision),
    audit_events: list(value.audit_events).map(normalizeAuditEvent),
  }
}

export function normalizeAdminAnnouncementPage(value = {}) {
  return {
    count: number(value.count),
    next: value.next || null,
    previous: value.previous || null,
    results: list(value.results).map(normalizeAdminAnnouncementListItem),
  }
}

function normalizeMetric(value = {}) {
  return {
    date: value.date || null,
    surface: text(value.surface),
    impressions: number(value.impressions),
    unique_impressions: number(value.unique_impressions),
    clicks: number(value.clicks),
    unique_clicks: number(value.unique_clicks),
    dismisses: number(value.dismisses),
    ctr: number(value.ctr),
    dismiss_rate: number(value.dismiss_rate),
  }
}

export function normalizeAdminAnnouncementMetrics(value = {}) {
  return {
    public_id: text(value.public_id),
    date_from: value.date_from || null,
    date_to: value.date_to || null,
    consent_notice: text(value.consent_notice),
    summary: normalizeMetric(value.summary),
    daily: list(value.daily).map(normalizeMetric),
  }
}

export function latestAnnouncementRevision(detail) {
  return detail?.revisions?.[0] || { ...DEFAULT_ADMIN_ANNOUNCEMENT_REVISION }
}
