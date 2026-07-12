import { Link } from 'react-router-dom'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/site-settings'

export default function BrandLogo({
  variant = 'full',
  to = '/',
  className = '',
  imageClassName = '',
  markClassName = '',
  textClassName = '',
  showText,
  dark = false,
}) {
  const { settings, siteName } = useSiteSettings()
  const primaryColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
  const logoUrl = settingText(settings.brand_logo_url, DEFAULT_SITE_SETTINGS.brand_logo_url)
  const markUrl = settingText(settings.brand_logo_mark_url, logoUrl || DEFAULT_SITE_SETTINGS.brand_logo_mark_url)
  const imageUrl = variant === 'mark' ? markUrl : logoUrl
  const shouldShowText = showText ?? (variant !== 'mark' && !logoUrl)

  return (
    <Link
      to={to}
      aria-label={siteName}
      title={siteName}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={siteName}
          className={`h-9 max-w-[180px] object-contain ${imageClassName}`}
        />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-sm ${markClassName}`}
          style={{ backgroundColor: primaryColor }}
          aria-hidden="true"
        >
          CV
        </span>
      )}

      {shouldShowText && (
        <span className={`text-lg font-extrabold ${dark ? 'text-white' : 'text-gray-900'} ${textClassName}`}>
          {siteName}
        </span>
      )}
    </Link>
  )
}
