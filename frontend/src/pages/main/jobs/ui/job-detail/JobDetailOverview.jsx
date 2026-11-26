import {
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  SendOutlined,
  ShareAltOutlined,
  ThunderboltFilled,
} from '@ant-design/icons'
import { Skeleton } from 'antd'
import { Link } from 'react-router'
import {
  EXPERIENCE_YEARS_LABELS,
  formatDeadline,
  formatJobPostedLabel,
  formatNumber,
  formatSalary,
  getSalaryDisplayNote,
  JobPresentationLabels,
  VerifiedEmployerBadge,
} from '@/entities/job/job'
import { JobCompareButton } from '@/features/main/job/compare-jobs'
import { formatFlashBadgeStats, formatJobDate, isAcceptingApplications } from '../../lib/job-detail-presentation'
import JobApplicationClosed from './JobApplicationClosed'
import { getIntlLocale } from '@/shared/config/i18n'

const EMPTY_LABEL = 'Chưa cập nhật'

// Phosphor Icons duotone (MIT © 2023 Phosphor Icons): [lớp nền mờ, lớp nét].
const FACT_ICONS = {
  location: ['M128,24a80,80,0,0,0-80,80c0,72,80,128,80,128s80-56,80-128A80,80,0,0,0,128,24Zm0,112a32,32,0,1,1,32-32A32,32,0,0,1,128,136Z', 'M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z'],
  experience: ['M176,96a48,48,0,1,1-48-48A48,48,0,0,1,176,96Z', 'M216,96A88,88,0,1,0,72,163.83V240a8,8,0,0,0,11.58,7.16L128,225l44.43,22.21A8.07,8.07,0,0,0,176,248a8,8,0,0,0,8-8V163.83A87.85,87.85,0,0,0,216,96ZM56,96a72,72,0,1,1,72,72A72.08,72.08,0,0,1,56,96ZM168,227.06l-36.43-18.21a8,8,0,0,0-7.16,0L88,227.06V174.37a87.89,87.89,0,0,0,80,0ZM128,152A56,56,0,1,0,72,96,56.06,56.06,0,0,0,128,152Zm0-96A40,40,0,1,1,88,96,40,40,0,0,1,128,56Z'],
  deadline: ['M216,48V88H40V48a8,8,0,0,1,8-8H208A8,8,0,0,1,216,48Z', 'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z'],
}

export function JobBreadcrumbs({ job }) {
  return (
    <nav className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-gray-500 sm:text-sm">
      <Link to="/" className="shrink-0 font-medium !text-slate-700 transition-colors hover:!text-[var(--brand-primary)]">Trang chủ</Link>
      <span className="text-gray-300">›</span>
      <Link to="/viec-lam" className="shrink-0 font-medium !text-slate-700 transition-colors hover:!text-[var(--brand-primary)]">Việc làm</Link>
      {job.category_name && <><span className="text-gray-300">›</span><Link to={`/viec-lam?cat=${job.category}`} className="shrink-0 font-medium !text-slate-700 transition-colors hover:!text-[var(--brand-primary)]">{job.category_name}</Link></>}
      <span className="text-gray-300">›</span>
      <span className="truncate font-medium text-slate-700">{job.title}</span>
    </nav>
  )
}

export function JobHero({ job, saved, applicationStatus, onApply, onSave, onShare, savePending }) {
  const locations = job.locations_detail?.map((location) => location.name).join(' · ') || EMPTY_LABEL
  const deadline = formatDeadline(job.deadline)
  const experience = EXPERIENCE_YEARS_LABELS[job.experience_years] || EMPTY_LABEL
  const published = formatJobPostedLabel(job)
  const salary = formatSalary(job)
  const salaryNote = getSalaryDisplayNote(job)

  return (
    <section className="job-hero">
      <div className="job-hero__head">
        <div className="min-w-0">
          <div className="job-hero__meta">
            <JobPresentationLabels job={job} />
            {published && <span>{published}</span>}
            <span className="job-hero__views" title={`${formatNumber(job.view_count)} lượt xem`}>
              <EyeOutlined aria-hidden="true" /> {formatNumber(job.view_count)} lượt xem
            </span>
            {job.flash_badge_stats && (
              <span data-testid="flash-badge-stats">
                <ThunderboltFilled className="text-amber-500" aria-hidden="true" /> {formatFlashBadgeStats(job.flash_badge_stats)}
              </span>
            )}
          </div>
          <h1 className="job-hero__title">
            {job.title}
            {' '}
            <VerifiedEmployerBadge
              verification={job.company_verification}
              verified={job.company_verified}
              showCriteria
            />
          </h1>
          {job.company_name && <p className="job-hero__company">{job.company_name}</p>}
        </div>
        <button type="button" onClick={onShare} className="job-hero__share" aria-label="Chia sẻ việc làm" title="Sao chép liên kết để chia sẻ"><ShareAltOutlined /></button>
      </div>

      <p className="job-hero__salary" aria-label={`Mức lương: ${salary}${salaryNote ? `, ${salaryNote}` : ''}`}>
        <strong>{salary}</strong>
        {salaryNote && <span className="job-hero__salary-note">{salaryNote}</span>}
      </p>

      <dl className="job-hero__facts">
        <HeroFact icon="location" label="Địa điểm" value={locations} />
        <HeroFact icon="experience" label="Kinh nghiệm" value={experience} />
        {job.deadline && (
          <HeroFact icon="deadline" label="Hạn ứng tuyển" value={formatJobDate(job.deadline)} note={deadline} />
        )}
      </dl>

      <div className="job-hero__actions">
        <div className="min-w-0 flex-1">
          {isAcceptingApplications(job)
            ? (
                <button type="button" onClick={onApply} disabled={applicationStatus.isLimitReached} className="job-hero__cta job-hero__apply">
                  {applicationStatus.isResubmission ? <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" /> : <SendOutlined aria-hidden="true" />}
                  {applicationStatus.applyLabel}
                </button>
              )
            : <JobApplicationClosed className="job-hero__cta" />}
          <LatestApplicationNotice application={applicationStatus.latestApplication} />
        </div>
        <button type="button" onClick={onSave} disabled={savePending} aria-pressed={saved} className="job-hero__cta job-hero__save">
          {saved ? <HeartFilled aria-hidden="true" /> : <HeartOutlined aria-hidden="true" />}
          {saved ? 'Đã lưu' : 'Lưu tin'}
        </button>
        <JobCompareButton job={job} variant="reveal" className="job-hero__cta job-hero__compare" />
      </div>
    </section>
  )
}

function LatestApplicationNotice({ application }) {
  if (!application?.applied_at) return null
  const appliedDate = new Date(application.applied_at)
  const formattedDate = Number.isNaN(appliedDate.getTime())
    ? ''
    : appliedDate.toLocaleDateString(getIntlLocale())
  return (
    <p className="mt-2 text-xs leading-5 text-slate-500">
      Bạn đã gửi CV cho vị trí này ngày: <strong className="text-slate-700">{formattedDate}.</strong>{' '}
      {application.cv_public_id
        ? <Link to={`/cv/${application.cv_public_id}/xem`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--brand-primary)] hover:underline">Xem CV đã nộp</Link>
        : <span className="font-semibold text-slate-700">Xem CV đã nộp</span>}
    </p>
  )
}

function HeroFact({ icon, label, value, note }) {
  return (
    <div className="job-hero__fact">
      <svg className="job-hero__fact-icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <path d={FACT_ICONS[icon][0]} opacity="0.2" />
        <path d={FACT_ICONS[icon][1]} />
      </svg>
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd title={value}>
          {value}
          {note && <span className="job-hero__fact-note">{note}</span>}
        </dd>
      </div>
    </div>
  )
}

export function JobDetailSkeleton() {
  return <><div className="job-detail-search h-[68px] bg-[var(--brand-primary)]" /><div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active title={{ width: '65%' }} paragraph={{ rows: 4 }} /></div><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active paragraph={{ rows: 10 }} /></div></div><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active avatar paragraph={{ rows: 6 }} /></div></div></>
}
