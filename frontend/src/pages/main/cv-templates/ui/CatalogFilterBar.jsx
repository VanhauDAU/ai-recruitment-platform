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
 * Mỗi entry: [keywords[], iconName]
 * Tránh khai báo JSX trực tiếp trong mảng tĩnh để không bị lỗi thiếu key.
 */
const ICON_RULES = [
  [['it', 'tech', 'cong-nghe', 'developer', 'software', 'lap-trinh', 'backend', 'frontend'], 'code'],
  [['marketing', 'truyen-thong', 'digital', 'quang-cao'], 'rocket'],
  [['kinh-doanh', 'sales', 'ban-hang', 'business'], 'shop'],
  [['tai-chinh', 'ke-toan', 'finance', 'accounting'], 'trophy'],
  [['nhan-su', 'hr', 'human', 'tuyen-dung', 'recruitment'], 'team'],
  [['thiet-ke', 'design', 'ui', 'ux', 'sang-tao', 'creative'], 'bulb'],
  [['giao-duc', 'education', 'giang-day', 'training'], 'global'],
  [['y-te', 'health', 'duoc', 'medical', 'bac-si', 'dieu-duong'], 'heart'],
  [['ky-thuat', 'engineering', 'co-khi', 'dien', 'xay-dung'], 'thunderbolt'],
  [['quan-ly', 'manager', 'management', 'giam-doc', 'truong-phong'], 'star'],
  [['fresher', 'intern', 'thuc-tap', 'sinh-vien', 'graduate'], 'user'],
  [['premium', 'pro', 'vip'], 'crown'],
  [['don-gian', 'simple', 'basic'], 'file'],
  [['chuyen-nghiep', 'professional', 'senior'], 'star'],
  [['kinh-te', 'economy', 'thuong-mai', 'commerce'], 'compass'],
]

function getCategoryIcon(slug, name) {
  const haystack = `${slug || ''} ${name || ''}`.toLowerCase()
  let type = 'file'
  
  for (const [keywords, iconName] of ICON_RULES) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      type = iconName
      break
    }
  }

  switch (type) {
    case 'code': return <CodeOutlined />
    case 'rocket': return <RocketOutlined />
    case 'shop': return <ShopOutlined />
    case 'trophy': return <TrophyOutlined />
    case 'team': return <TeamOutlined />
    case 'bulb': return <BulbOutlined />
    case 'global': return <GlobalOutlined />
    case 'heart': return <HeartOutlined />
    case 'thunderbolt': return <ThunderboltOutlined />
    case 'star': return <StarOutlined />
    case 'user': return <UserOutlined />
    case 'crown': return <CrownOutlined />
    case 'compass': return <CompassOutlined />
    case 'file':
    default:
      return <FileTextOutlined />
  }
}

function FilterPill({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition cursor-pointer',
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
