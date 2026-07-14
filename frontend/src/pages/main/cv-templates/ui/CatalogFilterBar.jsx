import {
  AppstoreOutlined,
  BulbOutlined,
  CodeOutlined,
  CompassOutlined,
  CrownOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HeartOutlined,
  RocketOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import LocaleDropdown from './LocaleDropdown'

/**
 * Mỗi entry: [keywords[], icon]
 * keywords sẽ được kiểm tra với slug hoặc name (lowercase) của category từ API.
 */
const ICON_RULES = [
  [['it', 'tech', 'cong-nghe', 'developer', 'software', 'lap-trinh', 'backend', 'frontend'], <CodeOutlined />],
  [['marketing', 'truyen-thong', 'digital', 'quang-cao'], <RocketOutlined />],
  [['kinh-doanh', 'sales', 'ban-hang', 'business'], <ShopOutlined />],
  [['tai-chinh', 'ke-toan', 'finance', 'accounting'], <TrophyOutlined />],
  [['nhan-su', 'hr', 'human', 'tuyen-dung', 'recruitment'], <TeamOutlined />],
  [['thiet-ke', 'design', 'ui', 'ux', 'sang-tao', 'creative'], <BulbOutlined />],
  [['giao-duc', 'education', 'giang-day', 'training'], <GlobalOutlined />],
  [['y-te', 'health', 'duoc', 'medical', 'bac-si', 'dieu-duong'], <HeartOutlined />],
  [['ky-thuat', 'engineering', 'co-khi', 'dien', 'xay-dung'], <ThunderboltOutlined />],
  [['quan-ly', 'manager', 'management', 'giam-doc', 'truong-phong'], <StarOutlined />],
  [['fresher', 'intern', 'thuc-tap', 'sinh-vien', 'graduate'], <UserOutlined />],
  [['premium', 'pro', 'vip'], <CrownOutlined />],
  [['don-gian', 'simple', 'basic'], <FileTextOutlined />],
  [['chuyen-nghiep', 'professional', 'senior'], <StarOutlined />],
  [['kinh-te', 'economy', 'thuong-mai', 'commerce'], <CompassOutlined />],
]

function getCategoryIcon(slug, name) {
  const haystack = `${slug || ''} ${name || ''}`.toLowerCase()
  for (const [keywords, icon] of ICON_RULES) {
    if (keywords.some((kw) => haystack.includes(kw))) return icon
  }
  return <FileTextOutlined />
}

function FilterPill({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition',
        active
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]',
      ].join(' ')}
    >
      {icon && <span className="text-[14px] leading-none">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

export default function CatalogFilterBar({ categories, activeSlug, onSelect, locale, localeOptions, onLocaleChange }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:pb-0">
        <FilterPill
          active={!activeSlug}
          icon={<AppstoreOutlined className="text-[15px]" />}
          onClick={() => onSelect(null)}
        >
          Tất cả
        </FilterPill>
        {categories.map((item) => (
          <FilterPill
            key={item.slug}
            active={activeSlug === item.slug}
            icon={getCategoryIcon(item.slug, item.name)}
            onClick={() => onSelect(item)}
          >
            {item.name}
          </FilterPill>
        ))}
      </div>
      <div className="shrink-0">
        <LocaleDropdown value={locale} options={localeOptions} onChange={onLocaleChange} />
      </div>
    </div>
  )
}
