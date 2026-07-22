import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import {
  EDUCATION_LEVEL_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_YEARS_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  formatDeadline,
  formatLocations,
  formatSalary,
} from '../lib/job-options'
import {
  jobContentLines,
  previewBenefitLines,
  previewLocationLines,
  previewScheduleLines,
} from '../lib/job-preview-presentation'

// Panel xem nhanh nổi bên cạnh tiêu đề job khi di chuột (dùng trong BestJobs).
export default function JobPreviewPanel({
  job,
  company,
  logoBg,
  logoFg,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
  onViewDetail,
  onApply,
  side = 'left',
}) {
  const [scrolled, setScrolled] = useState(false)
  if (!anchorRect) return null

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const panelWidth = Math.min(520, viewportWidth - 24)
  const panelHeight = Math.min(560, viewportHeight - 88)
  const preferredLeft = side === 'right'
    ? anchorRect.right + 14
    : anchorRect.left - panelWidth - 14
  const left = Math.max(12, Math.min(preferredLeft, viewportWidth - panelWidth - 12))
  const maxTop = Math.max(76, viewportHeight - panelHeight - 12)
  const top = Math.min(Math.max(anchorRect.top - 8, 76), maxTop)
  const locationLabel = formatLocations(job)
  const deadlineLabel = formatDeadline(job.deadline)
  const highlights = [
    { label: 'Hình thức', value: (job.work_types?.length ? job.work_types : [job.work_type]).filter(Boolean).map((value) => WORK_TYPE_LABELS[value] || value).join(', ') },
    { label: 'Loại công việc', value: EMPLOYMENT_TYPE_LABELS[job.employment_type] },
    { label: 'Cấp bậc', value: POSITION_LEVEL_LABELS[job.position_level] },
    { label: 'Học vấn', value: EDUCATION_LEVEL_LABELS[job.education_level] },
    { label: 'Số lượng tuyển', value: job.number_of_vacancies ? `${job.number_of_vacancies} người` : null },
  ].filter((item) => item.value)
  const sections = [
    { title: 'Mô tả công việc', lines: jobContentLines(job.description || job.short_description) },
    { title: 'Yêu cầu ứng viên', lines: jobContentLines(job.requirements) },
    { title: 'Quyền lợi', lines: previewBenefitLines(job) },
    { title: 'Địa điểm làm việc', lines: previewLocationLines(job) },
    { title: 'Thời gian làm việc', lines: previewScheduleLines(job) },
  ].filter((section) => section.lines.length > 0)

  function handleScroll(e) {
    const nextScrolled = e.currentTarget.scrollTop > 48
    setScrolled((current) => (current === nextScrolled ? current : nextScrolled))
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-2xl shadow-black/20"
      style={{ left, top, width: panelWidth, maxHeight: panelHeight }}
    >
      <div
        className="overflow-y-auto px-5 pt-5 pb-24 [scrollbar-width:thin]"
        style={{ maxHeight: panelHeight }}
        onScroll={handleScroll}
      >
        <div
          className={`sticky top-0 z-10 -mx-5 -mt-5 overflow-hidden border-gray-100 bg-white px-5 pt-5 transition-all duration-200 ease-out ${
            scrolled
              ? 'mb-4 max-h-28 translate-y-0 border-b pb-3 opacity-100'
              : 'pointer-events-none mb-0 max-h-0 -translate-y-2 border-b-0 pb-0 opacity-0'
          }`}
        >
          <p className="line-clamp-2 text-base font-semibold leading-snug text-[#17324d]">{job.title}</p>
          <p className="mt-1 truncate text-xs uppercase text-gray-400">{job.company_name}</p>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            scrolled ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
          }`}
        >
          <div className="flex gap-4 overflow-hidden">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-100 text-2xl font-bold"
            style={{ background: logoBg, color: logoFg }}
          >
            {job.company_logo_url ? (
              <img
                src={job.company_logo_url}
                alt={job.company_name}
                className="h-full w-full rounded-lg bg-white object-contain p-1"
                loading="lazy"
              />
            ) : company.charAt(0) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 text-base font-semibold leading-snug text-[#17324d]">{job.title}</p>
            <p className="mt-1 truncate text-xs uppercase text-gray-400">{job.company_name}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-primary)]">{formatSalary(job)}</p>
          </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {locationLabel && (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
              <EnvironmentOutlined /> {locationLabel}
            </span>
          )}
          {job.experience_years && (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
              <SafetyCertificateOutlined /> {EXPERIENCE_YEARS_LABELS[job.experience_years]}
            </span>
          )}
          {deadlineLabel && (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
              <ClockCircleOutlined /> {deadlineLabel}
            </span>
          )}
        </div>

        {highlights.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{item.label}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-5 text-sm text-gray-700">
          {sections.map((section) => (
            <PreviewSection key={section.title} title={section.title} lines={section.lines} />
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onApply}
          className="h-10 flex-1 cursor-pointer rounded-md border border-[var(--brand-primary)] bg-white text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-green-50"
        >
          Ứng tuyển
        </button>
        <button
          type="button"
          onClick={onViewDetail}
          className="inline-flex h-10 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] text-sm font-semibold text-white transition hover:bg-[#009944]"
        >
          <EyeOutlined className="text-xs" />
          Xem chi tiết
        </button>
      </div>
    </div>
  )
}

function PreviewSection({ title, lines }) {
  if (lines.length === 0) return null
  return (
    <section>
      <h4 className="mb-2 border-l-4 border-[var(--brand-primary)] pl-2 text-sm font-semibold text-[#17324d]">{title}</h4>
      <ul className="space-y-1.5 pl-4 text-xs leading-relaxed text-gray-600">
        {lines.map((line, index) => (
          <li key={`${title}-${index}`} className="list-disc marker:text-[var(--brand-primary)]">{line}</li>
        ))}
      </ul>
    </section>
  )
}
