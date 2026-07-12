import {
  AppstoreOutlined,
  DollarOutlined,
  FieldTimeOutlined,
  LaptopOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Skeleton } from 'antd'
import ArrowButton from '@/components/ui/ArrowButton'
import { formatNumber } from '@/entities/job'

function ShortcutCard({ icon, img, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-[128px] shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border bg-white px-2 py-3.5 text-center transition ${
        active ? 'border-[var(--brand-primary)] bg-green-50/60' : 'border-gray-200 hover:border-[var(--brand-primary)] hover:shadow-sm'
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-lg ${
          img ? 'bg-white ring-1 ring-gray-100' : active ? 'bg-[var(--brand-primary)] text-white' : 'bg-emerald-50 text-[var(--brand-primary)]'
        }`}
      >
        {img ? <img src={img} alt="" className="h-7 w-7 object-contain" loading="lazy" /> : icon}
      </span>
      <span className="line-clamp-2 h-8 text-xs font-medium leading-snug text-gray-700">{label}</span>
    </button>
  )
}

export default function QuickExplore({
  canScrollLeft,
  canScrollRight,
  expYears,
  groups,
  noExpCount,
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
      icon: <ReadOutlined />,
      active: searchParams.get('level') === 'intern',
      onClick: () => onToggleParam('level', 'intern'),
    },
    {
      key: 'part-time',
      label: 'Part-time, thời vụ',
      icon: <FieldTimeOutlined />,
      active: searchParams.get('et') === 'part_time',
      onClick: () => onToggleParam('et', 'part_time'),
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
    // Pill kèm số chỉ có nghĩa khi đã biết số và số > 0; chưa có thì ẩn hẳn
    // thay vì hiện "... việc làm" / "0 việc làm".
    ...(noExpCount
      ? [{
          key: 'no-exp',
          label: `${formatNumber(noExpCount)} việc làm không cần kinh nghiệm`,
          icon: <RocketOutlined />,
          active: expYears.includes('none'),
          onClick: () => onToggleExperienceYears('none'),
        }]
      : []),
  ]

  return (
    <>
      <div className="relative mt-4">
        <div
          ref={scrollerRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sidebarLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="w-[128px] shrink-0 rounded-xl border border-gray-200 bg-white px-2 py-3.5">
                  <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '90%'] }} />
                </div>
              ))
            : (
              <>
                {shortcutSpecials.map((shortcut) => (
                  <ShortcutCard
                    key={shortcut.key}
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
                <ShortcutCard icon={<AppstoreOutlined />} label="Xem tất cả ngành nghề" onClick={onOpenAllCategories} />
              </>
            )}
        </div>
        {!sidebarLoading && canScrollLeft && (
          <ArrowButton
            dir="left"
            onClick={() => onScroll(-1)}
            className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-md shadow-black/10"
          />
        )}
        {!sidebarLoading && canScrollRight && (
          <ArrowButton
            dir="right"
            onClick={() => onScroll(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white shadow-md shadow-black/10"
          />
        )}
      </div>

      {sidebarLoading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[168, 132, 108, 232].map((width) => (
            <Skeleton.Button key={width} active size="small" style={{ width, borderRadius: 9999 }} />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickPills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={pill.onClick}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                pill.active
                  ? 'border-[var(--brand-primary)] bg-green-50 text-[var(--brand-primary)]'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
              }`}
            >
              {pill.icon}
              {pill.label}
              <RightOutlined className="text-[10px]" />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
