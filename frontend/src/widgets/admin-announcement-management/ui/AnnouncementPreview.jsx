import { DesktopOutlined, MobileOutlined } from '@ant-design/icons'
import { Segmented, Tag } from 'antd'
import { useState } from 'react'
import {
  ANNOUNCEMENT_KINDS,
  normalizeAnnouncementUrl,
} from '@/entities/announcement'
import { KIND_LABELS } from '../model/announcement-options'

const KIND_CLASS = {
  [ANNOUNCEMENT_KINDS.CRITICAL]: 'is-critical',
  [ANNOUNCEMENT_KINDS.SECURITY]: 'is-security',
  [ANNOUNCEMENT_KINDS.COMPLIANCE]: 'is-compliance',
  [ANNOUNCEMENT_KINDS.WARNING]: 'is-warning',
  [ANNOUNCEMENT_KINDS.MAINTENANCE]: 'is-warning',
  [ANNOUNCEMENT_KINDS.SUCCESS]: 'is-success',
}

function localized(values, field, locale) {
  if (locale === 'en') return values?.[`${field}_en`]?.trim() || values?.[`${field}_vi`]
  return values?.[`${field}_vi`]
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

  return (
    <section className="announcement-preview" aria-label="Xem trước thông báo">
      <div className="announcement-preview__toolbar">
        <Segmented
          aria-label="Thiết bị xem trước"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: 'Desktop', icon: <DesktopOutlined /> },
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
            KIND_CLASS[values.kind] || '',
            `is-motion-${animation}`,
          ].filter(Boolean).join(' ')}
          style={{ '--announcement-preview-motion-period': `${displaySeconds}s` }}
        >
          <span className="announcement-preview__icon" aria-hidden="true">
            {values.kind === ANNOUNCEMENT_KINDS.CRITICAL ? '!' : '✦'}
          </span>
          <span className="announcement-preview__content">
            {badge && <Tag className="!m-0">{badge}</Tag>}
            <span className="announcement-preview__message">{message}</span>
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
        {KIND_LABELS[values.kind] || 'Thông tin'} ·
        {' '}
        {animation} ·
        {' '}
        {displaySeconds} giây
      </p>
    </section>
  )
}
