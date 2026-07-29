import { ANNOUNCEMENT_SURFACES } from '@/entities/announcement'

const VALID_SURFACES = new Set(Object.values(ANNOUNCEMENT_SURFACES))

export function parseAnnouncementRollout(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase()
  if (!normalized || normalized === 'none') return new Set()
  if (normalized === 'all') return new Set(VALID_SURFACES)
  return new Set(
    normalized
      .split(',')
      .map((surface) => surface.trim())
      .filter((surface) => VALID_SURFACES.has(surface)),
  )
}

export function isAnnouncementSurfaceEnabled(
  surface,
  rawValue,
) {
  const configured = rawValue ?? globalThis
    .__ANNOUNCEMENT_ROLLOUT_SURFACES__
    ?? import.meta.env.VITE_ANNOUNCEMENT_ROLLOUT_SURFACES
  return parseAnnouncementRollout(configured).has(surface)
}
