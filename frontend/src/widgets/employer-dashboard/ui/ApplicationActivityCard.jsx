import { RiseOutlined } from '@ant-design/icons'
import { Progress, Tag } from 'antd'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })

export default function ApplicationActivityCard({ activity = [], summary = {} }) {
  const maxCount = Math.max(1, ...activity.map((item) => item.count || 0))
  const pipelineTotal = Math.max(summary.applications_total || 0, 1)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="activity-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="activity-title" className="text-lg font-extrabold text-slate-900">Hiệu quả tuyển dụng</h2>
          <p className="mt-1 text-sm text-slate-500">Hồ sơ ứng tuyển trong 7 ngày gần nhất</p>
        </div>
        <Tag color="green" icon={<RiseOutlined />}>{summary.applications_total || 0} hồ sơ</Tag>
      </div>

      <div className="mt-7 grid h-48 grid-cols-7 items-end gap-2 border-b border-slate-100 pb-2 sm:gap-3">
        {activity.map((item) => {
          const height = item.count ? Math.max(12, Math.round((item.count / maxCount) * 100)) : 4
          return (
            <div key={item.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <span className="text-xs font-bold text-slate-600">{item.count || ''}</span>
              <span
                className="w-full max-w-10 rounded-t-lg bg-[linear-gradient(180deg,#20c974,#00a34a)] transition-all"
                style={{ height: `${height}%` }}
                role="img"
                aria-label={`${item.count || 0} hồ sơ ngày ${dateFormatter.format(new Date(`${item.date}T00:00:00`))}`}
              />
              <span className="truncate text-[10px] text-slate-400 sm:text-xs">{dateFormatter.format(new Date(`${item.date}T00:00:00`))}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <PipelineStat label="Mới nhận" value={summary.applications_new || 0} total={pipelineTotal} color="#1677ff" />
        <PipelineStat label="Đã chọn lọc" value={summary.applications_shortlisted || 0} total={pipelineTotal} color="#faad14" />
        <PipelineStat label="Phỏng vấn" value={summary.applications_interviewed || 0} total={pipelineTotal} color="#00b14f" />
      </div>
    </section>
  )
}

function PipelineStat({ label, value, total, color }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-500">{label}</span><strong className="text-slate-800">{value}</strong></div>
      <Progress percent={Math.round((value / total) * 100)} showInfo={false} strokeColor={color} size="small" />
    </div>
  )
}
