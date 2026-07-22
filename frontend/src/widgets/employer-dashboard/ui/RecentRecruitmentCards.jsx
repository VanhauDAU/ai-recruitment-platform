import { FileSearchOutlined, InboxOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Tag } from 'antd'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const JOB_STATUS = {
  active: { label: 'Đang tuyển', color: 'green' },
  pending: { label: 'Chờ duyệt', color: 'gold' },
  draft: { label: 'Bản nháp', color: 'default' },
  closed: { label: 'Đã đóng', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
}
const APPLICATION_STATUS = {
  submitted: { label: 'Mới', color: 'blue' },
  viewed: { label: 'Đã xem', color: 'cyan' },
  considering: { label: 'Cân nhắc', color: 'orange' },
  shortlisted: { label: 'Phù hợp', color: 'gold' },
  interviewed: { label: 'Phỏng vấn', color: 'purple' },
  accepted: { label: 'Đã nhận', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
}

function EmptyState({ type }) {
  const job = type === 'jobs'
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl bg-slate-50 px-5 text-center">
      {job ? <FileSearchOutlined className="text-3xl text-slate-300" /> : <InboxOutlined className="text-3xl text-slate-300" />}
      <strong className="mt-3 text-sm text-slate-700">{job ? 'Chưa có tin tuyển dụng' : 'Chưa có hồ sơ ứng tuyển'}</strong>
      <p className="mt-1 text-xs leading-5 text-slate-400">{job ? 'Tin đầu tiên của bạn sẽ xuất hiện tại đây.' : 'Hồ sơ mới sẽ được cập nhật theo thời gian thực.'}</p>
    </div>
  )
}

export function RecentJobsCard({ jobs = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-slate-900">Tin tuyển dụng gần đây</h2><p className="mt-1 text-sm text-slate-500">Theo dõi trạng thái và hiệu suất từng tin</p></div><FileSearchOutlined className="text-xl text-emerald-600" /></div>
      {!jobs.length ? <EmptyState type="jobs" /> : (
        <div className="divide-y divide-slate-100">
          {jobs.map((job) => {
            const status = JOB_STATUS[job.status] || { label: job.status_label || job.status, color: 'default' }
            return (
              <article key={job.public_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 basis-56"><h3 className="truncate text-sm font-bold text-slate-900">{job.title}</h3><p className="mt-1 text-xs text-slate-400">Tạo ngày {dateFormatter.format(new Date(job.created_at))}</p></div>
                <div className="flex items-center gap-4 text-xs text-slate-500"><span><strong className="text-slate-800">{job.application_count}</strong> hồ sơ</span><span><strong className="text-slate-800">{job.view_count}</strong> lượt xem</span></div>
                <Tag color={status.color}>{status.label}</Tag>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function RecentApplicationsCard({ applications = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-slate-900">Ứng viên mới nhất</h2><p className="mt-1 text-sm text-slate-500">Hồ sơ được sắp xếp theo thời gian ứng tuyển</p></div><UserOutlined className="text-xl text-emerald-600" /></div>
      {!applications.length ? <EmptyState type="applications" /> : (
        <div className="divide-y divide-slate-100">
          {applications.map((application) => {
            const status = APPLICATION_STATUS[application.status] || { label: application.status_label || application.status, color: 'default' }
            return (
              <article key={application.public_id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                <Avatar className="!bg-emerald-50 !font-bold !text-emerald-700">{application.candidate_name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</Avatar>
                <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-slate-900">{application.candidate_name}</h3><p className="mt-1 truncate text-xs text-slate-500">{application.job_title} · {dateFormatter.format(new Date(application.applied_at))}</p></div>
                <Tag color={status.color}>{status.label}</Tag>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
