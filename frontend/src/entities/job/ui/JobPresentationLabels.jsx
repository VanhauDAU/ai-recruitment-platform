import { resolveJobPresentation } from '../lib/job-presentation'

const LABEL_CLASSES = {
  sponsored: 'bg-slate-100 text-slate-600 ring-slate-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-orange-50 text-orange-700 ring-orange-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export default function JobPresentationLabels({ job, compact = false, className = '' }) {
  const labels = resolveJobPresentation(job).labels || []
  if (!labels.length) return null

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {labels.map((label) => (
        <span
          key={label.code}
          data-job-label={label.code}
          className={`inline-flex items-center rounded font-bold ring-1 ${
            compact ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2 py-0.5 text-[11px]'
          } ${LABEL_CLASSES[label.tone] || LABEL_CLASSES.sponsored}`}
        >
          {label.text}
        </span>
      ))}
    </span>
  )
}
