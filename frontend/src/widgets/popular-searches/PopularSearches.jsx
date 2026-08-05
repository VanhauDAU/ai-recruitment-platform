import {
  AppstoreOutlined,
  DownOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  TagsOutlined,
  ToolOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getLinkGroups, useSiteSettings } from '@/entities/site-settings'

// Số chip hiển thị trước khi thu gọn — nhóm khu vực/ngành nghề có thể rất dài.
const VISIBLE_ITEMS = 10

const GROUP_ICONS = {
  'footer-locations': <EnvironmentOutlined />,
  'footer-categories': <AppstoreOutlined />,
  'footer-cv': <FileTextOutlined />,
  'footer-tools': <ToolOutlined />,
}

const CHIP_BASE = 'inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] leading-5 transition-colors'

// Render Link nếu có url thật, ngược lại là chip mờ (tính năng sắp ra mắt).
function Chip({ url, children }) {
  if (!url) {
    return (
      <span
        className={`${CHIP_BASE} cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400`}
        title="Sắp ra mắt"
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      to={url}
      className={`${CHIP_BASE} border-slate-200 !bg-white !text-slate-600 hover:!border-[var(--brand-primary)] hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]`}
    >
      {children}
    </Link>
  )
}

function GroupCard({ group }) {
  const [expanded, setExpanded] = useState(false)
  const items = group.items || []
  if (!items.length) return null

  const hidden = items.length - VISIBLE_ITEMS
  const visible = expanded ? items : items.slice(0, VISIBLE_ITEMS)

  return (
    <section
      aria-labelledby={`popular-${group.key}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
    >
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
          {GROUP_ICONS[group.key] || <TagsOutlined />}
        </span>
        <h3 id={`popular-${group.key}`} className="text-sm font-bold text-slate-900">
          {group.title}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((item, index) => (
          <Chip key={`${item.label}-${index}`} url={item.url}>{item.label}</Chip>
        ))}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-hover)]"
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${hidden} mục`}
          {expanded ? <UpOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
        </button>
      )}
    </section>
  )
}

export default function PopularSearches() {
  const [groups, setGroups] = useState([])
  const { settings } = useSiteSettings()

  useEffect(() => {
    getLinkGroups('footer_seo').then(setGroups).catch(() => {})
  }, [])

  if (settings.home_show_popular_searches === false || !groups.length) return null

  return (
    <section aria-labelledby="popular-searches-heading" className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary)]">Khám phá thêm</p>
          <h2 id="popular-searches-heading" className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            Tìm kiếm phổ biến
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Việc làm theo khu vực, ngành nghề và các công cụ hỗ trợ ứng viên.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
          {groups.map((group) => <GroupCard key={group.key} group={group} />)}
        </div>
      </div>
    </section>
  )
}
