import {
  AppstoreOutlined,
  BulbOutlined,
  CodeOutlined,
  CompassOutlined,
  CrownOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HeartOutlined,
  LeftOutlined,
  RightOutlined,
  RocketOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
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

// Danh mục cùng loại đứng cạnh nhau và ngăn nhau bằng vạch mờ, để một hàng
// cuộn ngang vẫn đọc được như nhiều nhóm thay vì một chuỗi chip rời rạc.
const GROUP_ORDER = ['style', 'audience', 'position', 'feature']

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

function groupByType(categories) {
  const known = GROUP_ORDER.map((type) => categories.filter((item) => item.category_type === type))
  const rest = categories.filter((item) => !GROUP_ORDER.includes(item.category_type))
  return [...known, rest].filter((group) => group.length > 0)
}

function FilterPill({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-active={active}
      className={[
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition cursor-pointer',
        active
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]',
      ].join(' ')}
    >
      {icon && <span aria-hidden className="text-[14px] leading-none">{icon}</span>}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  )
}

function ScrollArrow({ side, onClick }) {
  const isLeft = side === 'left'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? 'Xem danh mục trước đó' : 'Xem thêm danh mục'}
      className={[
        'absolute top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full',
        'border border-slate-200 bg-white text-slate-500 shadow-md transition cursor-pointer',
        'hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:inline-flex',
        isLeft ? '-left-1' : '-right-1',
      ].join(' ')}
    >
      {isLeft ? <LeftOutlined className="text-xs" /> : <RightOutlined className="text-xs" />}
    </button>
  )
}

export default function CatalogFilterBar({ categories, activeSlug, onSelect, locale, localeOptions, onLocaleChange }) {
  const trackRef = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const syncEdges = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const furthest = track.scrollWidth - track.clientWidth
    setEdges({ start: track.scrollLeft <= 1, end: track.scrollLeft >= furthest - 1 })
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return undefined
    syncEdges()
    const observer = new ResizeObserver(syncEdges)
    observer.observe(track)
    return () => observer.disconnect()
  }, [syncEdges, categories])

  // Vào trang bằng URL danh mục thì chip tương ứng có thể nằm ngoài tầm nhìn.
  useEffect(() => {
    trackRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeSlug, categories])

  const scrollByPage = (direction) => {
    const track = trackRef.current
    track?.scrollBy({ left: direction * Math.round(track.clientWidth * 0.8), behavior: 'smooth' })
  }

  // Mask thay cho gradient màu nền: dải mờ ở mép báo còn nội dung để cuộn mà
  // không phải biết trang đang dùng nền gì.
  const fade = [
    edges.start ? null : 'transparent 0, black 2.5rem',
    edges.end ? null : 'black calc(100% - 2.5rem), transparent 100%',
  ].filter(Boolean).join(', ')
  const maskImage = fade ? `linear-gradient(to right, ${fade})` : undefined

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FilterPill
          active={!activeSlug}
          icon={<AppstoreOutlined className="text-[15px]" />}
          onClick={() => onSelect(null)}
        >
          Tất cả
        </FilterPill>

        <div className="relative min-w-0 flex-1">
          {!edges.start && <ScrollArrow side="left" onClick={() => scrollByPage(-1)} />}
          <div
            ref={trackRef}
            onScroll={syncEdges}
            role="group"
            aria-label="Lọc mẫu CV theo danh mục"
            style={{ maskImage, WebkitMaskImage: maskImage }}
            className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {groupByType(categories).map((group, index) => (
              <div key={group[0].category_type || index} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden data-role="group-separator" className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
                )}
                {group.map((item) => (
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
            ))}
          </div>
          {!edges.end && <ScrollArrow side="right" onClick={() => scrollByPage(1)} />}
        </div>
      </div>

      <div className="shrink-0">
        <LocaleDropdown value={locale} options={localeOptions} onChange={onLocaleChange} />
      </div>
    </div>
  )
}
