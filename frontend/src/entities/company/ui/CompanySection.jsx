import {
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import RichContent from '@/shared/ui/RichContent'
import ShareButtons from '@/shared/ui/ShareButtons'
import CompanyGallery from './CompanyGallery'

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
            {/^https?:\/\//i.test(item.href || '') ? (
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
            {office.label && <p className="text-xs text-gray-500">{office.label}</p>}
            <p className="mt-0.5 break-words leading-5 text-slate-700">{office.address}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

// Bộ hiển thị chỉ rẽ nhánh theo `section.type` của read model, không theo tên
// cột của Company. Kiểu chưa biết (kể cả kiểu của giai đoạn sau) bị bỏ qua.
function defaultBody(section, preview) {
  switch (section.type) {
    case 'rich_text':
      return hasRichText(section.body_html) ? <RichContent html={section.body_html} /> : null
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
