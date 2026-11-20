import { EnvironmentOutlined, StarFilled } from '@ant-design/icons'
import { bannerTheme, normalizePublicUrl } from '@/entities/content/banner'
import { formatNumber } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'
import { MATCHING_JOBS_PATH, companyJobsHref, slideHref } from '../model/slide-links'
import SlideLink from './SlideLink'

const SLIDE_BOX = 'relative h-full w-full overflow-hidden rounded-md'
const TEXT_PAD = 'px-4 pt-3 pb-6 sm:px-8 sm:py-4 md:px-12 md:py-6'
const CTA = 'inline-flex items-center rounded-lg !bg-white px-3 py-1.5 text-sm font-medium transition sm:px-4 sm:py-2'

function ImageSlide({ banner, eager }) {
  return (
    <SlideLink href={slideHref(banner)} className={`${SLIDE_BOX} block bg-gray-100`} aria-label={banner.title}>
      <img
        src={banner.image_url}
        alt={banner.title}
        title={banner.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </SlideLink>
  )
}

function SlideText({ eyebrow, title, subtitle, theme, children }) {
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col justify-center">
      {eyebrow && <p className={`mb-1 text-xs font-semibold tracking-wide sm:text-sm ${theme.eyebrow}`}>{eyebrow}</p>}
      <h3 className="line-clamp-2 text-base font-bold leading-snug sm:text-2xl">{title}</h3>
      {/* Khung 2:1 trên điện thoại chỉ đủ nhãn, tiêu đề và nút; mô tả hiện từ `sm`. */}
      {subtitle && <p className={`mt-2 hidden max-w-md text-base sm:line-clamp-2 ${theme.text}`}>{subtitle}</p>}
      {children && <div className="mt-2.5 flex flex-wrap gap-2 sm:mt-4">{children}</div>}
    </div>
  )
}

function PromoSlide({ banner, eager }) {
  const theme = bannerTheme(banner.theme)
  const href = normalizePublicUrl(banner.cta_url || '')
  return (
    <div className={`${SLIDE_BOX} ${TEXT_PAD} flex items-center gap-6 bg-gradient-to-br text-white ${theme.gradient}`}>
      <SlideText eyebrow={banner.eyebrow} title={banner.title} subtitle={banner.subtitle} theme={theme}>
        {banner.cta_label && href && <SlideLink href={href} className={`${CTA} ${theme.button}`}>{banner.cta_label}</SlideLink>}
      </SlideText>
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="hidden h-full max-h-60 w-2/5 shrink-0 rounded-lg object-cover md:block"
        />
      )}
    </div>
  )
}

function CompanySlide({ banner, eager }) {
  const company = banner.company
  const theme = bannerTheme(banner.theme)
  const name = company.trade_name || company.company_name
  const count = company.active_public_job_count || 0
  const industries = (company.industries_detail || []).slice(0, 2)
  return (
    <div className={`${SLIDE_BOX} bg-gradient-to-br text-white ${theme.gradient}`}>
      {company.cover_image_url && (
        <img
          src={company.cover_image_url}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
      <div className={`relative flex h-full items-center gap-4 sm:gap-6 ${TEXT_PAD}`}>
        {company.logo_url && (
          <span className="hidden size-20 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow sm:flex">
            <img src={company.logo_url} alt={name} className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <SlideText
          eyebrow={banner.eyebrow || m.banner_company_eyebrow()}
          title={banner.title || name}
          subtitle={banner.subtitle || company.description_excerpt}
          theme={{ eyebrow: 'text-white/80', text: 'text-white/85' }}
        >
          <SlideLink href={companyJobsHref(company)} className={`${CTA} !text-gray-900 hover:!bg-gray-100`}>
            {count > 0 ? m.banner_company_open_jobs({ count: formatNumber(count) }) : m.banner_company_view_jobs()}
          </SlideLink>
          <SlideLink
            href={slideHref(banner)}
            className="inline-flex items-center rounded-lg border border-white/70 px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium !text-white transition hover:!bg-white/10"
          >
            {banner.cta_label || m.banner_company_view()}
          </SlideLink>
          {company.headquarters && (
            <span className="hidden items-center gap-1 self-center text-sm text-white/80 lg:inline-flex">
              <EnvironmentOutlined /> <span className="line-clamp-1 max-w-56">{company.headquarters}</span>
            </span>
          )}
          {industries.map((item) => (
            <span key={item.id} className="hidden self-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs lg:inline">
              {item.name}
            </span>
          ))}
        </SlideText>
      </div>
    </div>
  )
}

/** Ứng viên đã đăng nhập thấy số việc phù hợp thật; khách thấy nội dung admin nhập. */
function aiContent(banner, personal) {
  if (personal?.status === 'ready' && personal.total > 0) {
    return {
      title: m.banner_ai_matches_title({ count: formatNumber(personal.total) }),
      subtitle: m.banner_ai_matches_subtitle(),
      cta: m.banner_ai_matches_cta(),
      href: MATCHING_JOBS_PATH,
    }
  }
  if (personal?.status === 'preferences_required') {
    return {
      title: m.banner_ai_setup_title(),
      subtitle: m.banner_ai_setup_subtitle(),
      cta: m.banner_ai_setup_cta(),
      href: MATCHING_JOBS_PATH,
    }
  }
  return {
    title: banner.title,
    subtitle: banner.subtitle,
    cta: banner.cta_label,
    href: normalizePublicUrl(banner.cta_url || ''),
  }
}

function AiSlide({ banner, personal }) {
  const theme = bannerTheme(banner.theme)
  const content = aiContent(banner, personal)
  return (
    <div className={`${SLIDE_BOX} ${TEXT_PAD} flex items-center gap-6 bg-gradient-to-br text-white ${theme.gradient}`}>
      <StarFilled aria-hidden className="pointer-events-none absolute -right-6 -bottom-10 text-[11rem] !text-white/10" />
      <SlideText eyebrow={banner.eyebrow} title={content.title} subtitle={content.subtitle} theme={theme}>
        {content.cta && content.href && (
          <SlideLink href={content.href} className={`${CTA} ${theme.button}`}>{content.cta}</SlideLink>
        )}
      </SlideText>
    </div>
  )
}

const SLIDES = { image: ImageSlide, company: CompanySlide, ai: AiSlide }

/**
 * Một slide của carousel banner theo `banner.kind`.
 * `personal` ({ status, total }) chỉ dùng cho slide AI; `eager` cho ảnh slide đầu.
 */
export default function HeroSlide({ banner, personal, eager = false }) {
  if (banner.kind === 'company' && !banner.company) return null
  if (banner.kind === 'image' && !banner.image_url) return null
  const Slide = SLIDES[banner.kind] || PromoSlide
  return <Slide banner={banner} personal={personal} eager={eager} />
}
