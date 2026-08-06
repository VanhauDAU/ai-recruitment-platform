import {
  ANNOUNCEMENT_BG_FITS,
  ANNOUNCEMENT_BG_OVERLAYS,
  applyOverlayTextContrast,
  resolveAnnouncementThemeTokens,
} from '@/entities/announcement'

const VALID_OVERLAYS = new Set(Object.values(ANNOUNCEMENT_BG_OVERLAYS))

function overlayLayer(overlay) {
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.LIGHT) {
    return 'linear-gradient(90deg, rgb(255 255 255 / 78%), rgb(255 255 255 / 58%))'
  }
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.DARK) {
    // Đủ tối để chữ trắng đọc được trên ảnh sáng.
    return 'linear-gradient(90deg, rgb(15 23 42 / 72%), rgb(15 23 42 / 58%))'
  }
  return null
}

/**
 * CSS variables + background layers for runtime strip (AN-V3).
 * System items without theme still resolve tokens from kind.
 */
export function buildAnnouncementStripVisual(item = {}) {
  const theme = item.theme || {}
  const background = item.background || {}
  const baseTokens = resolveAnnouncementThemeTokens({
    kind: item.kind,
    theme_mode: theme.mode,
    theme_preset: theme.preset,
    color_accent: theme.accent,
    color_bg_from: theme.bgFrom,
    color_bg_to: theme.bgTo,
    color_fg: theme.fg,
  })
  const imageUrl = background.imageUrl || ''
  const overlay = VALID_OVERLAYS.has(background.overlay)
    ? background.overlay
    : ANNOUNCEMENT_BG_OVERLAYS.NONE
  const fit = background.fit || ANNOUNCEMENT_BG_FITS.COVER
  const position = background.position || 'center'
  const overlayCss = overlayLayer(overlay)
  const tokens = applyOverlayTextContrast(baseTokens, overlay)

  const style = {
    '--announcement-accent': tokens.accent,
    '--announcement-bg-from': baseTokens.bgFrom,
    '--announcement-bg-to': baseTokens.bgTo,
    '--announcement-fg': tokens.fg,
  }
  if (tokens.badgeBg) {
    style['--announcement-badge-bg'] = tokens.badgeBg
    style['--announcement-badge-fg'] = tokens.badgeFg
    style['--announcement-badge-border'] = tokens.badgeBorder
  }

  if (imageUrl) {
    const layers = [
      overlayCss,
      `url("${imageUrl}")`,
      `linear-gradient(100deg, ${baseTokens.bgFrom}, ${baseTokens.bgTo})`,
    ].filter(Boolean)
    style.backgroundImage = layers.join(', ')
    style.backgroundSize = [
      overlayCss ? 'cover' : null,
      fit === ANNOUNCEMENT_BG_FITS.REPEAT_X ? 'auto 100%' : fit,
      'cover',
    ].filter(Boolean).join(', ')
    style.backgroundPosition = [
      overlayCss ? 'center' : null,
      position,
      'center',
    ].filter(Boolean).join(', ')
    style.backgroundRepeat = [
      overlayCss ? 'no-repeat' : null,
      fit === ANNOUNCEMENT_BG_FITS.REPEAT_X ? 'repeat-x' : 'no-repeat',
      'no-repeat',
    ].filter(Boolean).join(', ')
  }

  const classes = []
  if (imageUrl) classes.push('announcement-strip--has-bg')
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.DARK) classes.push('announcement-strip--overlay-dark')
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.LIGHT) classes.push('announcement-strip--overlay-light')

  return {
    style,
    hasBackgroundImage: Boolean(imageUrl),
    overlay,
    className: classes.join(' '),
  }
}
