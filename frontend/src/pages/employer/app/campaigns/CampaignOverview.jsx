import { Empty, Progress } from 'antd'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'

export default function CampaignOverview({ report = {} }) {
  const target = Number(report.headcount_target) || 0
  const accepted = Number(report.accepted_count) || 0
  const progress = target ? Math.min(Math.round((accepted / target) * 100), 100) : 0
  const funnel = Object.entries(report.funnel || {})

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <h2 className="text-base font-bold text-slate-800">Phễu xử lý hồ sơ</h2>
        {funnel.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {funnel.map(([status, count]) => (
              <div key={status} className="border border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500">{RECRUITER_APPLICATION_STATUS_LABELS[status] || status}</p>
                <strong className="mt-1 block text-xl text-slate-800">{count}</strong>
              </div>
            ))}
          </div>
        ) : <Empty className="py-12" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu hồ sơ" />}
      </section>
      <section className="border-l-0 border-slate-200 text-center lg:border-l lg:pl-5">
        <h2 className="text-left text-base font-bold text-slate-800">Tiến độ tuyển dụng</h2>
        <Progress className="mt-5" type="dashboard" percent={progress} strokeColor="#00b14f" />
        <p className="mt-3 text-sm text-slate-500">{accepted} ứng viên nhận offer{target ? ` / mục tiêu ${target}` : ''}</p>
      </section>
    </div>
  )
}
