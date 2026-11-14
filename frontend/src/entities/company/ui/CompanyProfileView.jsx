import CompanyHero from './CompanyHero'
import CompanySection from './CompanySection'
import './company-profile.css'

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const NO_SLOTS = {}

function accentValue(value, brandVariable) {
  return HEX_COLOR.test(value || '') ? value : `var(${brandVariable})`
}

// Màu nhấn chỉ tô chi tiết trang trí qua biến CSS cục bộ; giá trị thiếu hoặc
// không phải mã hex rơi về màu thương hiệu của nền tảng.
function accentStyle(theme) {
  const accent = theme?.accent
  return {
    '--company-accent': accentValue(accent?.primary, '--brand-primary'),
    '--company-accent-hover': accentValue(accent?.hover, '--brand-primary-hover'),
    '--company-accent-soft': accentValue(accent?.soft, '--brand-primary-soft'),
  }
}

/**
 * Bộ hiển thị trang công ty dùng chung cho trang công khai và các bản xem
 * trước. Entity không tự tải việc làm hay công ty tương tự, nên nơi dùng truyền
 * phần thân các khối đó qua `slots` (khoá là `section.type`); khối `jobs` và
 * `similar_companies` không có slot thì không hiển thị.
 *
 * - `heroActions`: nút hành động của nền tảng trong hero.
 * - `navigation`: thanh điều hướng giữa hero và nội dung (tab của trang công khai).
 * - `focusType`: cột chính chỉ còn các khối thuộc kiểu này (tab việc làm).
 * - `preview`: bản xem trước nhúng trong trang khác. Tên công ty không chiếm
 *   `h1` của trang chứa và khối chia sẻ (vốn chia sẻ URL hiện tại) bị ẩn.
 */
export default function CompanyProfileView({
  profile,
  heroActions,
  navigation,
  focusType,
  slots = NO_SLOTS,
  preview = false,
}) {
  const sections = (profile.sections || []).filter(
    (section) => !focusType || section.type === focusType,
  )

  return (
    <div className="company-profile" style={accentStyle(profile.theme)}>
      <CompanyHero profile={profile} actions={heroActions} titleAs={preview ? 'h2' : 'h1'} />
      {navigation}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {sections.map((section) => (
            <CompanySection key={section.key} section={section} slots={slots} preview={preview} />
          ))}
        </div>
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-[84px]">
          {(profile.sidebar || []).map((block) => (
            <CompanySection key={block.key} section={block} slots={slots} preview={preview} sidebar />
          ))}
        </aside>
      </div>
    </div>
  )
}
