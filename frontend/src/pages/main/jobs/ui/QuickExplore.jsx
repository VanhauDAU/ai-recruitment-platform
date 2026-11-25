import {
  AppstoreOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  LaptopOutlined,
  RightOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Skeleton } from 'antd'
import { Link } from 'react-router'
import { useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import ArrowButton from '@/shared/ui/ArrowButton'

const PILL_CLASS = 'job-list-chip inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition'
const PILL_IDLE_CLASS = 'border-gray-200 bg-white text-gray-700 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'

// Icon 3D (Fluent Emoji, MIT) cho các lối tắt không phải ngành; ảnh ngành lấy từ logo_url.
const SHORTCUT_ICON = {
  intern: '/images/categories/graduation_cap.webp',
  partTime: '/images/categories/alarm_clock.webp',
  allCategories: '/images/categories/card_index_dividers.webp',
}

function ShortcutCard({ icon, img, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`job-quick-explore__card group flex w-28 shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border bg-white px-1.5 py-2.5 text-center transition ${
        active ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]' : 'border-gray-200 hover:border-[var(--brand-primary)]'
      }`}
    >
      <span className="job-quick-explore__icon flex h-7 w-7 items-center justify-center text-xl text-[var(--brand-primary)]">
        {img ? <img src={img} alt="" className="h-7 w-7 object-contain" loading="lazy" /> : icon}
      </span>
      <span className="line-clamp-2 h-8 text-xs font-medium leading-4 text-gray-700">{label}</span>
    </button>
  )
}

export default function QuickExplore({
  canScrollLeft,
  canScrollRight,
  expYears,
  extraChip,
  groups,
  onOpenAllCategories,
  onScroll,
  onToggleCategory,
  onToggleParam,
  onToggleExperienceYears,
  ordering,
  scrollerRef,
  searchParams,
  selectedCategories,
  sidebarLoading,
}) {
  const shortcutSpecials = [
    {
      key: 'intern',
      label: 'Việc thực tập sinh',
      img: SHORTCUT_ICON.intern,
      active: searchParams.get('level') === 'intern',
      onClick: () => onToggleParam('level', 'intern'),
    },
    {
      key: 'part-time',
      label: 'Part-time, thời vụ',
      img: SHORTCUT_ICON.partTime,
      active: searchParams.get('et') === 'part_time',
      onClick: () => onToggleParam('et', 'part_time'),
    },
    {
      key: 'no-exp',
      label: 'Việc không cần kinh nghiệm',
      icon: <RocketOutlined />,
      active: expYears.includes('none'),
      onClick: () => onToggleExperienceYears('none'),
    },
  ]
  const quickPills = [
    {
      key: 'salary',
      label: 'Ưu tiên việc lương cao',
      icon: <DollarOutlined />,
      active: ordering === 'salary_desc',
      onClick: () => onToggleParam('sort', 'salary_desc'),
    },
    {
      key: 'remote',
      label: 'Làm việc từ xa',
      icon: <LaptopOutlined />,
      active: searchParams.get('wt') === 'remote',
      onClick: () => onToggleParam('wt', 'remote'),
    },
  ]
  const { settings } = useSiteSettings()
  const nearbyJobsEnabled = settings.nearby_jobs_enabled !== false

  return (
    <>
      <div className="relative mt-3">
        <div
          ref={scrollerRef}
          className="job-list-scroll-row flex gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sidebarLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="w-28 shrink-0 rounded-lg border border-gray-200 bg-white px-1.5 py-2.5">
                  <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '90%'] }} />
                </div>
              ))
            : (
              <>
                {shortcutSpecials.map((shortcut) => (
                  <ShortcutCard
                    key={shortcut.key}
                    img={shortcut.img}
                    icon={shortcut.icon}
                    label={shortcut.label}
                    active={shortcut.active}
                    onClick={shortcut.onClick}
                  />
                ))}
                {groups.map((group) => (
                  <ShortcutCard
                    key={group.id}
                    img={group.logo_url || undefined}
                    icon={<AppstoreOutlined />}
                    label={group.name}
                    active={selectedCategories.includes(group.id)}
                    onClick={() => onToggleCategory(group.id)}
                  />
                ))}
                <ShortcutCard img={SHORTCUT_ICON.allCategories} label="Xem tất cả ngành nghề" onClick={onOpenAllCategories} />
              </>
            )}
        </div>
        {!sidebarLoading && canScrollLeft && (
          <ArrowButton
            dir="left"
            onClick={() => onScroll(-1)}
            className="job-quick-explore__arrow absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-md shadow-black/10"
          />
        )}
        {!sidebarLoading && canScrollRight && (
          <ArrowButton
            dir="right"
            onClick={() => onScroll(1)}
            className="job-quick-explore__arrow absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white shadow-md shadow-black/10"
          />
        )}
      </div>

      {sidebarLoading ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {[168, 132, 108, 232].map((width) => (
            <Skeleton.Button key={width} active size="small" style={{ width, borderRadius: 9999 }} />
          ))}
        </div>
      ) : (
        <div className="job-list-scroll-row mt-2 flex flex-wrap gap-2">
          {nearbyJobsEnabled && (
            // Link là <a>: reset antd đè màu chữ/nền utility thường nên dùng `!`.
            <Link
              to="/viec-lam-gan-ban"
              className={`${PILL_CLASS} border-gray-200 !bg-white !text-gray-700 hover:border-[var(--brand-primary)] hover:!text-[var(--brand-primary)]`}
            >
              <EnvironmentOutlined aria-hidden />
              {m.candidate_nearby_hero_link()}
              <RightOutlined className="text-[10px]" />
            </Link>
          )}
          {quickPills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={pill.onClick}
              className={`${PILL_CLASS} ${
                pill.active
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                  : PILL_IDLE_CLASS
              }`}
            >
              {pill.icon}
              {pill.label}
              <RightOutlined className="text-[10px]" />
            </button>
          ))}
          {extraChip}
        </div>
      )}
    </>
  )
}
