import {
  ANNOUNCEMENT_BG_FITS,
  ANNOUNCEMENT_BG_OVERLAYS,
  resolveAnnouncementThemeTokens,
} from '@/entities/announcement'

function overlayLayer(overlay) {
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.LIGHT) {
    return 'linear-gradient(90deg, rgb(255 255 255 / 72%), rgb(255 255 255 / 48%))'
  }
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.DARK) {
    return 'linear-gradient(90deg, rgb(15 23 42 / 52%), rgb(15 23 42 / 36%))'
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
  const tokens = resolveAnnouncementThemeTokens({
    kind: item.kind,
    theme_mode: theme.mode,
    theme_preset: theme.preset,
    color_accent: theme.accent,
    color_bg_from: theme.bgFrom,
    color_bg_to: theme.bgTo,
    color_fg: theme.fg,
  })
  const imageUrl = background.imageUrl || ''
  const overlay = imageUrl
    ? (background.overlay || ANNOUNCEMENT_BG_OVERLAYS.DARK)
    : ANNOUNCEMENT_BG_OVERLAYS.NONE
  const fit = background.fit || ANNOUNCEMENT_BG_FITS.COVER
  const position = background.position || 'center'
  const overlayCss = overlayLayer(overlay)

  const style = {
    '--announcement-accent': tokens.accent,
    '--announcement-bg-from': tokens.bgFrom,
    '--announcement-bg-to': tokens.bgTo,
    '--announcement-fg': tokens.fg,
  }

  if (imageUrl) {
    const layers = [
      overlayCss,
      `url("${imageUrl}")`,
      `linear-gradient(100deg, ${tokens.bgFrom}, ${tokens.bgTo})`,
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

  return {
    style,
    hasBackgroundImage: Boolean(imageUrl),
    className: imageUrl ? 'announcement-strip--has-bg' : '',
  }
}
