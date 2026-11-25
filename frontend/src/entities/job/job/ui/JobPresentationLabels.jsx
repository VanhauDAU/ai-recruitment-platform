import { ClockCircleFilled, CrownFilled, FireFilled, ThunderboltFilled } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import { resolveJobPresentation } from '../lib/job-presentation'

const LABEL_CLASSES = {
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const SPONSORED_CLASSES = {
  orange: 'border-orange-200 bg-orange-100 text-orange-800',
  green: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  green_strong: 'border-emerald-700 bg-emerald-700 text-white shadow-sm shadow-emerald-700/20',
  neutral: 'border-slate-200 bg-white text-slate-700 shadow-sm',
}

function labelClass(label, presentation) {
  if (label.tone === 'sponsored') {
    return SPONSORED_CLASSES[presentation.card_tone] || SPONSORED_CLASSES.neutral
  }
  return LABEL_CLASSES[label.tone] || SPONSORED_CLASSES.neutral
}

function labelTitle(label, presentation) {
  if (label.code === 'sponsored') return presentation.display_reason || undefined
  // Huy hiệu Sấm Chớp: hệ thống tính từ việc NTD trả lời hồ sơ đúng hạn (ADR-0027).
  if (label.code === 'fast_response') return m.job_label_fast_response_hint()
  return undefined
}

function LabelIcon({ label }) {
  const Icon = label.code === 'sponsored'
    ? CrownFilled
    : label.code === 'hot'
      ? FireFilled
      : label.code === 'urgent'
        ? ClockCircleFilled
        : label.code === 'fast_response'
          ? ThunderboltFilled
          : null

  return Icon ? <Icon aria-hidden="true" className="text-[0.9em]" /> : null
}

export default function JobPresentationLabels({ job, compact = false, className = '' }) {
  const presentation = resolveJobPresentation(job)
  const labels = presentation.labels || []
  if (!labels.length) return null

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((label) => (
        <span
          key={label.code}
          data-job-label={label.code}
          title={labelTitle(label, presentation)}
          className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${
            compact ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2 py-1 text-[11px] leading-none'
          } ${labelClass(label, presentation)}`}
        >
          <LabelIcon label={label} />
          {label.text}
        </span>
      ))}
    </span>
  )
}
