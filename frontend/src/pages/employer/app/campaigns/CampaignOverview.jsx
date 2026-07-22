import { CheckCircleOutlined, FileTextOutlined, InboxOutlined, TeamOutlined } from '@ant-design/icons'
import { Card, Progress } from 'antd'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'

function MetricCard({ icon, label, value, hint, color = 'text-emerald-600' }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xl ${color}`}>{icon}</span>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><strong className="mt-1 block text-2xl text-slate-900">{value}</strong>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>
      </div>
    </Card>
  )
}

export default function CampaignOverview({ report }) {
  const totalApplications = report.applications?.total
    ?? Object.values(report.funnel || {}).reduce((sum, value) => sum + value, 0)
  const target = report.headcount_target || 1
  const recruitmentPercent = Math.min(Math.round(((report.accepted_count || 0) / target) * 100), 100)
  const maxDaily = Math.max(...(report.daily_applications || []).map((item) => item.count), 1)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<TeamOutlined />} label="Tổng CV ứng tuyển" value={totalApplications} hint={`${report.applications?.new || 0} hồ sơ mới cần xem`} />
        <MetricCard icon={<FileTextOutlined />} label="Tin tuyển dụng" value={report.jobs?.total || 0} hint={`${report.jobs?.active || 0} đang tuyển · ${report.jobs?.pending || 0} chờ duyệt`} color="text-blue-600" />
        <MetricCard icon={<InboxOutlined />} label="Lượt xem tin" value={report.jobs?.views || 0} hint="Tổng lượt xem của các tin trong chiến dịch" color="text-violet-600" />
        <MetricCard icon={<CheckCircleOutlined />} label="Đã nhận offer" value={`${report.accepted_count || 0}/${target}`} hint={`${recruitmentPercent}% mục tiêu`} color="text-orange-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card title="Phễu xử lý hồ sơ">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(report.funnel || {}).map(([status, count]) => (
              <div key={status} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{RECRUITER_APPLICATION_STATUS_LABELS[status] || status}</p>
                <strong className="text-xl text-slate-900">{count}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Tiến độ mục tiêu tuyển dụng">
          <div className="py-2 text-center"><Progress type="dashboard" percent={recruitmentPercent} strokeColor="#00b14f" /><p className="mt-2 text-sm text-slate-500">{report.accepted_count || 0} ứng viên nhận offer trên mục tiêu {target}</p></div>
        </Card>
      </div>

      <Card title="CV ứng tuyển 7 ngày gần nhất">
        <div className="grid h-40 grid-cols-7 items-end gap-2 sm:gap-4">
          {(report.daily_applications || []).map((item) => (
            <div key={item.date} className="flex h-full flex-col justify-end text-center">
              <span className="mb-1 text-xs font-bold text-slate-700">{item.count}</span>
              <span className="mx-auto w-full max-w-12 rounded-t bg-emerald-500" style={{ height: `${Math.max((item.count / maxDaily) * 100, 4)}%` }} />
              <span className="mt-2 text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
