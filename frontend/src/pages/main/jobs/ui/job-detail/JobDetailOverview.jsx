import {
  EnvironmentOutlined,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  UserOutlined,
  WalletOutlined,
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
} from '@/entities/job'
import { formatJobDate } from '../../lib/job-detail-presentation'
import VerifiedEmployerBadge from './VerifiedEmployerBadge'

const EMPTY_LABEL = 'Chưa cập nhật'

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

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-[var(--brand-primary)] via-emerald-400 to-emerald-100" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <JobPresentationLabels job={job} />
              {published && <span className="text-xs text-gray-400">{published}</span>}
            </div>
            <h1 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              {job.title}
              {' '}
              <VerifiedEmployerBadge
                verification={job.company_verification}
                verified={job.company_verified}
              />
            </h1>
            <p className="mt-1 text-sm font-medium text-gray-600">{job.company_name}</p>
          </div>
          <button type="button" onClick={onShare} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[var(--brand-primary)]" aria-label="Chia sẻ việc làm" title="Sao chép liên kết để chia sẻ"><ShareAltOutlined /></button>
        </div>

        <div className="mt-5 grid gap-3 border-y border-gray-100 py-4 sm:grid-cols-[1.15fr_1fr_0.8fr] sm:gap-0 sm:divide-x sm:divide-gray-100">
          <HeroMetric icon={<WalletOutlined />} label="Mức lương" value={formatSalary(job)} note={getSalaryDisplayNote(job)} highlight />
          <HeroMetric icon={<EnvironmentOutlined />} label="Địa điểm" value={locations} className="sm:pl-4" />
          <HeroMetric icon={<UserOutlined />} label="Kinh nghiệm" value={experience} className="sm:pl-4" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {deadline && <span className="text-gray-500">Hạn nộp hồ sơ: <strong className="font-semibold text-slate-700">{formatJobDate(job.deadline)} ({deadline})</strong></span>}
          <span className="inline-flex items-center gap-1.5 text-gray-500" title={`${formatNumber(job.view_count)} lượt xem`}>
            <EyeOutlined className="text-[var(--brand-primary)]" />
            {formatNumber(job.view_count)} lượt xem
          </span>
        </div>

        <div className="mt-5 flex gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onApply} disabled={applicationStatus.isLimitReached} className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60">{applicationStatus.hasApplied ? <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" /> : <SafetyCertificateOutlined />} {applicationStatus.hasApplied ? 'Ứng tuyển lại' : 'Ứng tuyển ngay'}</button>
            <LatestApplicationNotice application={applicationStatus.latestApplication} />
          </div>
          <button type="button" onClick={onSave} disabled={savePending} className="hidden h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-300 px-4 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex">{saved ? <HeartFilled /> : <HeartOutlined />} {saved ? 'Đã lưu' : 'Lưu tin'}</button>
        </div>
      </div>
    </section>
  )
}

function LatestApplicationNotice({ application }) {
  if (!application?.applied_at) return null
  const appliedDate = new Date(application.applied_at)
  const formattedDate = Number.isNaN(appliedDate.getTime())
    ? ''
    : appliedDate.toLocaleDateString('vi-VN')
  return (
    <p className="mt-2 text-xs leading-5 text-slate-500">
      Bạn đã gửi CV cho vị trí này ngày: <strong className="text-slate-700">{formattedDate}.</strong>{' '}
      {application.cv_public_id
        ? <Link to={`/cvs/${application.cv_public_id}/view`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--brand-primary)] hover:underline">Xem CV đã nộp</Link>
        : <span className="font-semibold text-slate-700">Xem CV đã nộp</span>}
    </p>
  )
}

function HeroMetric({ icon, label, value, note, highlight = false, className = '' }) {
  if (highlight) {
    return (
      <div
        role="group"
        aria-label={`${label}: ${value}${note ? `, ${note}` : ''}`}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white px-3.5 py-3 shadow-[0_4px_16px_rgba(0,176,80,0.08)] sm:-my-1 sm:mr-4"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-lg text-white shadow-sm">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
          <p className="mt-0.5 break-words text-xl font-extrabold leading-tight text-[var(--brand-primary)] sm:text-2xl" title={value}>{value}</p>
          {note && <p className="mt-1 text-xs font-medium leading-4 text-emerald-700">{note}</p>}
        </div>
      </div>
    )
  }

  return (
    <div role="group" aria-label={`${label}: ${value}`} className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span className="shrink-0 text-base text-[var(--brand-primary)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800" title={value}>{value}</p>
      </div>
    </div>
  )
}

export function JobDetailSkeleton() {
  return <><div className="h-[68px] bg-[var(--brand-primary)]" /><div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active title={{ width: '65%' }} paragraph={{ rows: 4 }} /></div><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active paragraph={{ rows: 10 }} /></div></div><div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active avatar paragraph={{ rows: 6 }} /></div></div></>
}
