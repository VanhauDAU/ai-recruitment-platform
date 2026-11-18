import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_BG_OVERLAYS,
  ANNOUNCEMENT_THEME_MODES,
  applyOverlayTextContrast,
  resolveAnnouncementThemeTokens,
} from './announcement.presentation'

describe('resolveAnnouncementThemeTokens', () => {
  it('uses kind tokens by default', () => {
    const tokens = resolveAnnouncementThemeTokens({ kind: 'success' })
    expect(tokens.accent).toBe('#15803d')
  })

  it('uses preset tokens', () => {
    const tokens = resolveAnnouncementThemeTokens({
      theme_mode: ANNOUNCEMENT_THEME_MODES.PRESET,
      theme_preset: 'ocean',
    })
    expect(tokens.accent).toBe('#0284c7')
  })

  it('prefers custom hex when provided', () => {
    const tokens = resolveAnnouncementThemeTokens({
      theme_mode: ANNOUNCEMENT_THEME_MODES.CUSTOM,
      kind: 'info',
      color_accent: '#112233',
      color_fg: '#445566',
    })
    expect(tokens.accent).toBe('#112233')
    expect(tokens.fg).toBe('#445566')
    expect(tokens.bgFrom).toBeTruthy()
  })

  it('switches to light text under dark overlay', () => {
    const base = resolveAnnouncementThemeTokens({ kind: 'info' })
    const tokens = applyOverlayTextContrast(base, ANNOUNCEMENT_BG_OVERLAYS.DARK)
    expect(tokens.fg).toBe('#f8fafc')
    expect(tokens.accent).toBe('#ffffff')
    expect(tokens.badgeFg).toBe('#0f172a')
  })
})
