import { EnvironmentOutlined, GlobalOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'

// Các khối hiển thị nhỏ của "Chi tiết tin tuyển dụng" — nhận view-model đã
// nhóm sẵn từ API detail (requirement_tags, benefit_tags, workplace_groups…)
// thay vì tự suy luận từ dữ liệu thô.

const COLLAPSED_MAX_HEIGHT = 96 // ≈ 3 dòng tag trên mobile

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

export function BenefitTags({ tags }) {
  if (!tags?.length) return null
  return <TagRow label="Quyền lợi">{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</TagRow>
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
      <h3 className="mb-3 text-sm font-bold text-slate-800">Yêu cầu ngoại ngữ</h3>
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
  if (!groups?.length) return null
  return (
    <section id="job-workplaces" className="scroll-mt-20">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Địa điểm làm việc</h3>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.province_id} className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800"><EnvironmentOutlined className="mr-1.5 text-[var(--brand-primary)]" />{group.province_name}</p>
            <ul className="mt-2 space-y-1.5 pl-6">
              {group.addresses.map((address, index) => (
                <li key={index} className="list-disc text-sm text-slate-600">{address.display}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
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
      <h3 className="mb-2 text-sm font-bold text-slate-800">Thời gian làm việc</h3>
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
