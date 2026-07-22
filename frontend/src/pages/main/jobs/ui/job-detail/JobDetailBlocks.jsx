import { EnvironmentOutlined, GiftOutlined, GlobalOutlined, ToolOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'

// Các khối hiển thị nhỏ của "Chi tiết tin tuyển dụng" — nhận view-model đã
// nhóm sẵn từ API detail (requirement_tags, benefit_tags, workplace_groups…)
// thay vì tự suy luận từ dữ liệu thô.

const COLLAPSED_MAX_HEIGHT = 96 // ≈ 3 dòng tag trên mobile
const MAX_VISIBLE_WORKPLACES = 3

// Tiêu đề mục con trong "Chi tiết tin tuyển dụng": thanh dọc trái cùng tông với tiêu đề h2 của thẻ,
// mảnh hơn một chút cho cân với cỡ chữ nhỏ hơn.
export function SectionHeading({ children }) {
  return <h3 className="mb-3 border-l-[3px] border-[var(--brand-primary)] pl-2.5 text-sm font-bold text-slate-800">{children}</h3>
}

function TagRow({ label, children }) {
  return <div className="flex flex-wrap items-start gap-2"><span className="mr-1 pt-1 text-sm font-semibold text-slate-700">{label}:</span>{children}</div>
}

function Tag({ children, highlighted }) {
  return <span className={`rounded-full px-3 py-1 text-xs ${highlighted ? 'bg-emerald-50 font-medium text-[var(--brand-primary)]' : 'bg-slate-100 text-slate-600'}`}>{children}</span>
}

export function RequirementTags({ tags }) {
  const containerRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    function measure() {
      const el = containerRef.current
      if (el) setOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tags])

  if (!tags?.length) return null
  return (
    <div>
      <div ref={containerRef} className={expanded ? '' : 'max-h-[96px] overflow-hidden sm:max-h-none'}>
        <TagRow label="Yêu cầu">{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</TagRow>
      </div>
      {overflowing && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1.5 cursor-pointer text-xs font-semibold text-[var(--brand-primary)] hover:underline sm:hidden">
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  )
}

function IconRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[var(--brand-primary)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  )
}

export function JobSkills({ required, preferred }) {
  const columns = [
    { label: 'Kỹ năng cần có', items: required },
    { label: 'Kỹ năng nên có', items: preferred },
  ].filter((column) => column.items?.length)
  if (!columns.length) return null
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
      {columns.map((column) => (
        <IconRow key={column.label} icon={<ToolOutlined />} label={column.label} value={column.items.join(', ')} />
      ))}
    </div>
  )
}

export function AdditionalBenefits({ groups }) {
  if (!groups?.length) return null
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quyền lợi bổ sung</p>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <IconRow key={group.category} icon={<GiftOutlined />} label={group.category_label} value={group.items.join(', ')} />
        ))}
      </div>
    </div>
  )
}

export function SpecialtyTags({ primary, domains }) {
  if (!primary && !domains?.length) return null
  return (
    <TagRow label="Chuyên môn">
      {primary && <Tag highlighted>{primary.name}</Tag>}
      {(domains || []).map((domain) => <Tag key={domain.id}>{domain.name}</Tag>)}
    </TagRow>
  )
}

export function LanguageRequirementList({ items }) {
  if (!items?.length) return null
  return (
    <section>
      <SectionHeading>Yêu cầu ngoại ngữ</SectionHeading>
      <ul className="space-y-2">
        {items.map((item) => {
          const parts = [item.language_name, item.proficiency_label, item.certificate].filter(Boolean)
          return (
            <li key={item.id || item.language} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <GlobalOutlined className="mt-0.5 text-[var(--brand-primary)]" />
              <span>
                {parts.join(' — ')}
                {item.is_required === false && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Ưu tiên</span>}
                {item.note && <span className="block text-xs text-gray-500">{item.note}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function WorkplaceGroups({ groups }) {
  const [expanded, setExpanded] = useState(false)
  if (!groups?.length) return null
  let remaining = MAX_VISIBLE_WORKPLACES
  const visibleGroups = groups
    .map((group) => {
      const addresses = (group.addresses || []).slice(0, remaining)
      remaining -= addresses.length
      return { ...group, addresses }
    })
    .filter((group) => group.addresses.length > 0)
  const totalLocations = groups.reduce((total, group) => total + (group.addresses?.length || 0), 0)
  const hiddenLocations = Math.max(0, totalLocations - MAX_VISIBLE_WORKPLACES)
  const displayedGroups = expanded ? groups : visibleGroups

  return (
    <section id="job-workplaces" className="scroll-mt-20">
      <SectionHeading>Địa điểm làm việc</SectionHeading>
      <div className="space-y-2 text-sm leading-6 text-slate-700">
        {displayedGroups.flatMap((group) => group.addresses.map((address, index) => (
          <p key={`${group.province_id}-${address.ward_id || 'province'}-${address.address_detail || index}`} className="flex items-start gap-2">
            <EnvironmentOutlined className="mt-1 shrink-0 text-[var(--brand-primary)]" />
            <span>
              <strong className="font-semibold text-slate-800">{group.province_name}:</strong>{' '}
              {workplaceAddressLabel(address, group.province_name) || group.province_name}
            </span>
          </p>
        )))}
        {hiddenLocations > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="ml-6 cursor-pointer text-left text-sm font-medium text-[var(--brand-primary)] hover:underline"
          >
            {expanded ? 'Thu gọn' : `... và ${hiddenLocations} địa điểm khác`}
          </button>
        )}
      </div>
    </section>
  )
}

function workplaceAddressLabel(address, provinceName) {
  const location = [address.address_detail, address.ward_name].filter(Boolean).join(', ')
  return location || (address.display !== provinceName ? address.display : '')
}

const WEEKDAY_LABELS = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' }

function scheduleLabel(item) {
  if (!item.weekday_from || !item.weekday_to) return item.note
  const days = item.weekday_from === item.weekday_to
    ? WEEKDAY_LABELS[item.weekday_from]
    : `${WEEKDAY_LABELS[item.weekday_from]} - ${WEEKDAY_LABELS[item.weekday_to]}`
  const time = item.start_time && item.end_time
    ? `, ${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}${item.is_overnight ? ' hôm sau' : ''}`
    : ''
  return `${days}${time}`
}

export function WorkScheduleList({ schedules, note }) {
  const rows = (schedules || [])
    .map((item) => ({ key: item.id ?? scheduleLabel(item), label: scheduleLabel(item), note: item.weekday_from ? item.note : '' }))
    .filter((row) => row.label)
  if (!rows.length && !note) return null
  return (
    <section>
      <SectionHeading>Thời gian làm việc</SectionHeading>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {rows.map((row) => (
          <li key={row.key}>
            {row.label}
            {row.note && <span className="text-gray-500"> ({row.note})</span>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-sm text-slate-600">{note}</p>}
    </section>
  )
}
