import { CheckCircleFilled, WarningFilled } from '@ant-design/icons'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { whiteContrastRatio } from '../model/setting-values'
import './site-settings.css'

function BrandPreview({ values, settingsByKey }) {
  const color = values.brand_primary_color
  const ratio = whiteContrastRatio(color)
  const logo = values.brand_logo_url === settingsByKey.brand_logo_url?.value
    ? settingsByKey.brand_logo_url?.display_value
    : values.brand_logo_url
  return (
    <div className="settings-preview__brand">
      <div className="settings-preview__header">
        {logo ? <img src={logo} alt="" /> : <strong>{values.site_name}</strong>}
        <span className="settings-preview__button" style={{ background: color }}>{m.admin_settings_preview_button()}</span>
      </div>
      <p className="settings-preview__tagline">{values.site_name} · {values.site_tagline}</p>
      {ratio && (
        <p className={`settings-preview__contrast${ratio < 4.5 ? ' settings-preview__contrast--low' : ''}`}>
          {ratio < 4.5 ? <WarningFilled aria-hidden="true" /> : <CheckCircleFilled aria-hidden="true" />}
          {m.admin_settings_preview_contrast({ ratio: ratio.toLocaleString(getIntlLocale(), { maximumFractionDigits: 1 }) })}
          {' · '}
          {ratio < 4.5 ? m.admin_settings_preview_contrast_low() : m.admin_settings_preview_contrast_ok()}
        </p>
      )}
    </div>
  )
}

function SeoPreview({ values }) {
  return (
    <div className="settings-preview__serp">
      <p className="settings-preview__label">{m.admin_settings_preview_seo()}</p>
      <p className="settings-preview__serp-url">{window.location.host}</p>
      <p className="settings-preview__serp-title">{values.seo_default_title}</p>
      <p className="settings-preview__serp-description">{values.seo_default_description}</p>
    </div>
  )
}

function CopyrightPreview({ values }) {
  const text = String(values.footer_copyright || '')
    .replaceAll('{year}', String(new Date().getFullYear()))
    .replaceAll('{site_name}', values.site_name || '')
  return text ? <p className="settings-preview__label">{m.admin_settings_preview_copyright({ text })}</p> : null
}

const PREVIEWS = { brand: BrandPreview, seo: SeoPreview, footer: CopyrightPreview }

/** Xem trước theo giá trị đang sửa (chưa lưu) cho nhóm có ý nghĩa trực quan. */
export default function SettingPreviews({ group, values, settingsByKey }) {
  const Preview = PREVIEWS[group]
  if (!Preview) return null
  return (
    <section className="settings-preview" aria-label={m.admin_settings_preview_title()}>
      <Preview values={values} settingsByKey={settingsByKey} />
    </section>
  )
}
