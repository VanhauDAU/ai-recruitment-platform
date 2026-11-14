import { LockOutlined } from '@ant-design/icons'
import { formatApplyRate, formatCount } from './job-list-presentation'

// Impressions only exist since engagement tracking started, so the funnel
// starts at views when a job has none recorded.
export default function JobEngagementPanel({ job, applicants }) {
  const steps = [
    job.impression_count > 0 && {
      key: 'impressions',
      label: 'Lượt hiển thị',
      hint: 'Tin xuất hiện trong danh sách, gợi ý',
      value: job.impression_count,
      bar: 'bg-sky-500',
    },
    { key: 'views', label: 'Lượt xem tin', hint: 'Mở trang chi tiết tin', value: job.view_count || 0, bar: 'bg-emerald-500' },
    { key: 'applicants', label: 'Ứng viên nộp hồ sơ', hint: 'Mỗi ứng viên tính một lần', value: applicants, bar: 'bg-violet-500' },
  ].filter(Boolean)
  const top = Math.max(steps[0].value, 1)

  return (
    <div className="p-4 sm:p-5">
      <ol className={`grid list-none gap-3 p-0 ${steps.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {steps.map((step, index) => {
          const previous = steps[index - 1]
          const rate = previous ? formatApplyRate(step.value, previous.value) : null
          return (
            <li key={step.key} data-testid={`job-funnel-${step.key}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{step.label}</span>
                {rate && <span className="text-xs font-semibold text-emerald-700">Chuyển đổi {rate}</span>}
              </div>
              <strong className="mt-1 block text-3xl font-bold tabular-nums text-slate-900">{formatCount(step.value)}</strong>
              <span aria-hidden className="mt-3 block h-2 overflow-hidden rounded-full bg-slate-100">
                <span className={`block h-full rounded-full ${step.bar}`} style={{ width: `${Math.max((step.value / top) * 100, step.value ? 2 : 0)}%` }} />
              </span>
              <span className="mt-2 block text-xs text-slate-400">{step.hint}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <LockOutlined aria-hidden className="mt-1 text-slate-400" />
        ProCV chỉ ghi nhận lượt xem ẩn danh, không lưu danh tính người xem tin mà chưa ứng tuyển.
      </p>
    </div>
  )
}
