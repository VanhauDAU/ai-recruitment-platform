import {
  BankOutlined,
  CalendarOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  GiftOutlined,
  GlobalOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  InstagramOutlined,
  LaptopOutlined,
  LinkedinFilled,
  TeamOutlined,
  TikTokOutlined,
  YoutubeFilled,
} from '@ant-design/icons'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import RichContent from '@/shared/ui/RichContent'
import ShareButtons from '@/shared/ui/ShareButtons'
import { companyVideoEmbed } from '../lib/company-video'
import CompanyGallery from './CompanyGallery'
import CompanyVideo from './CompanyVideo'

const HTTP_URL = /^https?:\/\//i
// Icon chỉ là trang trí theo nhóm danh mục; `icon` của danh mục chưa có định dạng chung.
const BENEFIT_ICONS = { allowance: DollarOutlined, equipment: LaptopOutlined, welfare: HeartOutlined }
const SOCIAL_ICONS = {
  facebook: FacebookFilled,
  linkedin: LinkedinFilled,
  youtube: YoutubeFilled,
  tiktok: TikTokOutlined,
  instagram: InstagramOutlined,
}

// Khối rich text chỉ được hiển thị khi còn chữ hoặc ảnh sau khi sanitize.
function hasRichText(html) {
  const template = document.createElement('template')
  template.innerHTML = sanitizeHtml(html)
  return Boolean(template.content.textContent.trim() || template.content.querySelector('img'))
}

// Icon chỉ là trang trí: mục có key lạ vẫn hiển thị với icon mặc định.
function factIcon(key) {
  switch (key) {
    case 'company_size': return <TeamOutlined />
    case 'industries': return <BankOutlined />
    case 'founded_year': return <CalendarOutlined />
    case 'website': return <GlobalOutlined />
    default: return <InfoCircleOutlined />
  }
}

function CompanyFacts({ items }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.key} className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-gray-500" aria-hidden="true">
            {factIcon(item.key)}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{item.label}</p>
            {HTTP_URL.test(item.href || '') ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-0.5 block break-words text-sm font-medium leading-5 !text-[var(--brand-primary)] hover:underline"
              >
                {item.value}
              </a>
            ) : (
              <p className="mt-0.5 break-words text-sm font-medium leading-5 text-slate-700">{item.value}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function CompanyOffices({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((office, index) => (
        <li key={`${office.label}-${index}`} className="flex items-start gap-2.5 text-sm">
          <EnvironmentOutlined className="mt-0.5 text-gray-400" aria-hidden="true" />
          <div className="min-w-0">
            {(office.label || office.is_headquarters) && (
              <p className="text-xs text-gray-500">
                {office.label}
                {office.is_headquarters && office.label !== 'Trụ sở chính' && (
                  <span className="company-profile-office-tag">Trụ sở chính</span>
                )}
              </p>
            )}
            <p className="mt-0.5 break-words leading-5 text-slate-700">{office.address}</p>
            {office.province_name && <p className="text-xs text-gray-500">{office.province_name}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function CompanyBenefits({ items, html }) {
  return (
    <>
      {items.length > 0 && (
        <ul className="company-profile-benefits">
          {items.map((item, index) => {
            const Icon = BENEFIT_ICONS[item.category] || GiftOutlined
            return (
              <li key={`${item.name}-${index}`} className="company-profile-benefit">
                <span className="company-profile-benefit__icon" aria-hidden="true"><Icon /></span>
                <div className="min-w-0">
                  <p className="company-profile-benefit__name">{item.name}</p>
                  {item.note && <p className="company-profile-benefit__note">{item.note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {html && <RichContent html={html} className={items.length > 0 ? 'mt-4' : ''} />}
    </>
  )
}

function CompanySocialLinks({ items }) {
  return (
    <ul className="company-profile-social">
      {items.map((item) => {
        const Icon = SOCIAL_ICONS[item.network] || GlobalOutlined
        return (
          <li key={`${item.network}-${item.url}`}>
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={item.label || item.network} className="company-profile-social__link">
              <Icon aria-hidden="true" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

// Bộ hiển thị chỉ rẽ nhánh theo `section.type` của read model, không theo tên
// cột của Company. Kiểu chưa biết (kể cả kiểu của giai đoạn sau) bị bỏ qua.
function defaultBody(section, preview) {
  switch (section.type) {
    case 'rich_text':
      return hasRichText(section.body_html) ? <RichContent html={section.body_html} /> : null
    case 'benefits': {
      const items = (section.items || []).filter((item) => item?.name)
      const html = hasRichText(section.body_html) ? section.body_html : ''
      return items.length || html ? <CompanyBenefits items={items} html={html} /> : null
    }
    case 'video': {
      const video = companyVideoEmbed(section)
      return video ? <CompanyVideo video={video} title={section.title} /> : null
    }
    case 'social_links': {
      // Chỉ liên kết http(s); mọi scheme khác (javascript:, data:) bị bỏ.
      const items = (section.items || []).filter((item) => HTTP_URL.test(item?.url || ''))
      return items.length ? <CompanySocialLinks items={items} /> : null
    }
    case 'gallery':
      return section.items?.length ? <CompanyGallery items={section.items} title={section.title} /> : null
    case 'facts':
      return section.items?.length ? <CompanyFacts items={section.items} /> : null
    case 'offices':
      return section.items?.length ? <CompanyOffices items={section.items} /> : null
    case 'share':
      // Nút chia sẻ dùng URL hiện tại nên không có nghĩa trong bản xem trước.
      return preview ? null : (
        <div className="flex flex-wrap gap-2">
          <ShareButtons copiedMessage="Đã sao chép đường dẫn công ty." />
        </div>
      )
    default:
      return null
  }
}

/**
 * Một khối của trang công ty. Khối không có nội dung thì không render gì, kể
 * cả tiêu đề. `slots[type]` thay phần thân mặc định của kiểu đó.
 */
export default function CompanySection({ section, slots, preview = false, sidebar = false }) {
  const body = Object.hasOwn(slots, section.type)
    ? slots[section.type]
    : defaultBody(section, preview)
  if (!body) return null
  const headingId = `company-section-${section.key}`

  return (
    <section
      aria-labelledby={headingId}
      className={sidebar
        ? 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm'
        : 'scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6'}
    >
      <h2
        id={headingId}
        className={sidebar
          ? 'text-base font-bold text-slate-800'
          : 'company-profile-heading border-l-4 pl-3 text-base font-bold text-slate-800 sm:text-lg'}
      >
        {section.title}
      </h2>
      <div className={sidebar ? 'mt-4' : 'mt-5'}>{body}</div>
    </section>
  )
}
