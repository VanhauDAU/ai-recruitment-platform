import { ArrowRightOutlined, FileSearchOutlined, InboxOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar } from 'antd'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const JOB_STATUS = {
  active: { label: 'Đang tuyển', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
  draft: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-600' },
  closed: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-500' },
  rejected: { label: 'Từ chối', className: 'bg-red-50 text-red-700' },
}
const APPLICATION_STATUS = {
  submitted: { label: 'Mới', className: 'bg-blue-50 text-blue-700' },
  viewed: { label: 'Đã xem', className: 'bg-cyan-50 text-cyan-700' },
  considering: { label: 'Cân nhắc', className: 'bg-orange-50 text-orange-700' },
  shortlisted: { label: 'Phù hợp', className: 'bg-amber-50 text-amber-700' },
  interviewed: { label: 'Phỏng vấn', className: 'bg-violet-50 text-violet-700' },
  accepted: { label: 'Đã nhận', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Từ chối', className: 'bg-red-50 text-red-700' },
}

function EmptyState({ type }) {
  const job = type === 'jobs'
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl text-slate-300 shadow-sm">{job ? <FileSearchOutlined /> : <InboxOutlined />}</span>
      <strong className="mt-3 text-sm text-slate-700">{job ? 'Chưa có tin tuyển dụng' : 'Chưa có hồ sơ ứng tuyển'}</strong>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{job ? 'Tạo tin đầu tiên để bắt đầu tiếp cận ứng viên phù hợp.' : 'Hồ sơ mới sẽ được cập nhật tại đây theo thời gian thực.'}</p>
      {job && <Link to={employerAppPath('/jobs/new')} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-600 !bg-emerald-600 px-3 text-xs font-bold !text-white shadow-sm transition hover:border-emerald-700 hover:!bg-emerald-700"><PlusOutlined /> Đăng tin mới</Link>}
    </div>
  )
}

function SectionHeader({ title, description, icon, to, actionLabel }) {
  const Icon = icon
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Icon /></span>
        <div className="min-w-0"><h2 className="text-base font-black text-slate-900 sm:text-lg">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
      </div>
      <Link to={to} className="inline-flex shrink-0 items-center gap-1.5 pt-1 text-xs font-bold !text-slate-500 transition hover:!text-emerald-600">{actionLabel}<ArrowRightOutlined /></Link>
    </div>
  )
}

export function RecentJobsCard({ jobs = [] }) {
  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)] sm:p-6">
      <SectionHeader title="Tin tuyển dụng gần đây" description="Trạng thái và hiệu suất từng tin" icon={FileSearchOutlined} to={employerAppPath('/jobs')} actionLabel="Xem tất cả" />
      {!jobs.length ? <EmptyState type="jobs" /> : (
        <div className="divide-y divide-slate-100">
          {jobs.map((job) => {
            const status = JOB_STATUS[job.status] || { label: job.status_label || job.status, className: 'bg-slate-100 text-slate-600' }
            return (
              <Link to={`${employerAppPath('/jobs')}/${job.public_id}`} key={job.public_id} className="group flex flex-col gap-3 py-4 first:pt-1 last:pb-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-emerald-700">{job.title}</h3><p className="mt-1 text-[11px] text-slate-400">Tạo ngày {dateFormatter.format(new Date(job.created_at))}</p></div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="flex items-center gap-4 text-[11px] text-slate-500"><span><strong className="text-slate-800">{job.application_count}</strong> hồ sơ</span><span><strong className="text-slate-800">{job.view_count}</strong> lượt xem</span></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                  <ArrowRightOutlined className="hidden text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500 sm:block" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function RecentApplicationsCard({ applications = [] }) {
  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)] sm:p-6">
      <SectionHeader title="Ứng viên mới nhất" description="Hồ sơ theo thời gian ứng tuyển" icon={UserOutlined} to={employerAppPath('/applications')} actionLabel="Xem tất cả" />
      {!applications.length ? <EmptyState type="applications" /> : (
        <div className="divide-y divide-slate-100">
          {applications.map((application) => {
            const status = APPLICATION_STATUS[application.status] || { label: application.status_label || application.status, className: 'bg-slate-100 text-slate-600' }
            return (
              <Link to={`${employerAppPath('/applications')}?job=${encodeURIComponent(application.job_public_id)}`} key={application.public_id} className="group flex items-center gap-3 py-3.5 first:pt-1 last:pb-0">
                <Avatar className="!shrink-0 !bg-emerald-50 !font-bold !text-emerald-700">{application.candidate_name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</Avatar>
                <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-emerald-700">{application.candidate_name}</h3><p className="mt-1 truncate text-[11px] text-slate-500">{application.job_title} · {dateFormatter.format(new Date(application.applied_at))}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                <ArrowRightOutlined className="hidden text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500 sm:block" />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
