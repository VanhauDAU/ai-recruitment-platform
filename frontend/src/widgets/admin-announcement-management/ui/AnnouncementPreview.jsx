import { DesktopOutlined, MobileOutlined, TabletOutlined } from '@ant-design/icons'
import { Segmented, Tag } from 'antd'
import { useMemo, useState } from 'react'
import {
  ANNOUNCEMENT_BG_OVERLAYS,
  ANNOUNCEMENT_KINDS,
  normalizeAnnouncementUrl,
  resolveAnnouncementThemeTokens,
} from '@/entities/announcement'
import { KIND_LABELS } from '../model/announcement-options'

function localized(values, field, locale) {
  if (locale === 'en') return values?.[`${field}_en`]?.trim() || values?.[`${field}_vi`]
  return values?.[`${field}_vi`]
}

function overlayLayer(overlay) {
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.LIGHT) {
    return 'linear-gradient(90deg, rgb(255 255 255 / 72%), rgb(255 255 255 / 55%))'
  }
  if (overlay === ANNOUNCEMENT_BG_OVERLAYS.DARK) {
    return 'linear-gradient(90deg, rgb(15 23 42 / 55%), rgb(15 23 42 / 40%))'
  }
  return null
}

export default function AnnouncementPreview({ values = {} }) {
  const [device, setDevice] = useState('desktop')
  const [locale, setLocale] = useState('vi')
  const message = localized(values, 'message', locale) || 'Nội dung thông báo sẽ xuất hiện tại đây.'
  const badge = localized(values, 'badge', locale)
  const ctaLabel = localized(values, 'cta_label', locale)
  const safeUrl = normalizeAnnouncementUrl(values.cta_url)
  const animation = values.animation || 'slide'
  const displaySeconds = values.display_seconds || 6
  const tokens = useMemo(() => resolveAnnouncementThemeTokens(values), [values])
  const bgUrl = values.background_image_url || ''
  const overlay = values.background_image
    ? (values.background_overlay || ANNOUNCEMENT_BG_OVERLAYS.DARK)
    : ANNOUNCEMENT_BG_OVERLAYS.NONE
  const fit = values.background_fit || 'cover'
  const position = values.background_position || 'center'

  const stripStyle = {
    '--announcement-preview-motion-period': `${displaySeconds}s`,
    color: tokens.fg,
    backgroundImage: [
      overlayLayer(overlay),
      bgUrl ? `url("${bgUrl}")` : null,
      `linear-gradient(100deg, ${tokens.bgFrom}, ${tokens.bgTo})`,
    ].filter(Boolean).join(', '),
    backgroundSize: [
      overlayLayer(overlay) ? 'cover' : null,
      bgUrl ? (fit === 'repeat-x' ? 'auto 100%' : fit) : null,
      'cover',
    ].filter(Boolean).join(', '),
    backgroundPosition: [
      overlayLayer(overlay) ? 'center' : null,
      bgUrl ? position : null,
      'center',
    ].filter(Boolean).join(', '),
    backgroundRepeat: [
      overlayLayer(overlay) ? 'no-repeat' : null,
      bgUrl ? (fit === 'repeat-x' ? 'repeat-x' : 'no-repeat') : null,
      'no-repeat',
    ].filter(Boolean).join(', '),
  }

  return (
    <section className="announcement-preview" aria-label="Xem trước thông báo">
      <div className="announcement-preview__toolbar">
        <Segmented
          aria-label="Thiết bị xem trước"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: 'Desktop', icon: <DesktopOutlined /> },
            { value: 'tablet', label: 'Tablet', icon: <TabletOutlined /> },
            { value: 'mobile', label: 'Mobile', icon: <MobileOutlined /> },
          ]}
        />
        <Segmented
          aria-label="Ngôn ngữ xem trước"
          value={locale}
          onChange={setLocale}
          options={[
            { value: 'vi', label: 'VI' },
            { value: 'en', label: 'EN' },
          ]}
        />
      </div>
      <div className={`announcement-preview__viewport is-${device}`}>
        <div className="announcement-preview__browser-bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div
          className={[
            'announcement-preview__strip',
            bgUrl ? 'has-bg' : '',
            `is-motion-${animation}`,
          ].filter(Boolean).join(' ')}
          style={stripStyle}
        >
          <span
            className="announcement-preview__icon"
            aria-hidden="true"
            style={{ color: tokens.accent, borderColor: tokens.accent }}
          >
            {values.kind === ANNOUNCEMENT_KINDS.CRITICAL ? '!' : '✦'}
          </span>
          <span className={`announcement-preview__content is-${device}`}>
            {badge && <Tag className="!m-0">{badge}</Tag>}
            <span className={`announcement-preview__message is-${device}`}>{message}</span>
            {ctaLabel && safeUrl && (
              <span className="announcement-preview__cta">
                {ctaLabel}
                <span aria-hidden="true">→</span>
              </span>
            )}
          </span>
        </div>
        <div className="announcement-preview__page-skeleton" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </div>
      <p className="announcement-preview__caption">
        {KIND_LABELS[values.kind] || 'Thông tin'}
        {' · '}
        {values.theme_mode || 'kind'}
        {bgUrl ? ' · có ảnh nền' : ''}
        {' · '}
        {animation}
        {' · '}
        {displaySeconds}
        {' '}
        giây
      </p>
    </section>
  )
}
