import { ClockCircleFilled, ThunderboltFilled } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import { jobLabels } from '../lib/job-presentation'

const LABEL_STYLES = {
  closing_soon: { Icon: ClockCircleFilled, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  // Huy hiệu Sấm Chớp: hệ thống tính từ việc NTD trả lời hồ sơ đúng hạn (ADR-0027).
  fast_response: {
    Icon: ThunderboltFilled,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    title: () => m.job_label_fast_response_hint(),
  },
}

export default function JobPresentationLabels({ job, compact = false, className = '' }) {
  const labels = jobLabels(job).filter((label) => LABEL_STYLES[label.code])
  if (!labels.length) return null

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((label) => {
        const { Icon, className: tone, title } = LABEL_STYLES[label.code]
        return (
          <span
            key={label.code}
            data-job-label={label.code}
            title={title?.()}
            className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${
              compact ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2 py-1 text-[11px] leading-none'
            } ${tone}`}
          >
            <Icon aria-hidden="true" className="text-[0.9em]" />
            {label.text}
          </span>
        )
      })}
    </span>
  )
}
