import { CheckOutlined, SwapOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { message } from '@/shared/lib/toast'
import useJobComparison from '../model/use-job-comparison'

const VARIANT_CLASSES = {
  compact: 'h-8 w-8 rounded-full',
  icon: 'h-10 w-10 rounded-lg',
  reveal: 'group/compare h-11 w-11 gap-0 overflow-hidden rounded-lg px-0 hover:w-[7.25rem] hover:gap-2 focus-visible:w-[7.25rem] focus-visible:gap-2',
  text: 'h-11 gap-2 rounded-lg px-4',
}

export default function JobCompareButton({
  job,
  variant = 'icon',
  className = '',
  showLabel = variant === 'text' || variant === 'reveal',
}) {
  const { hasJob, toggleJob } = useJobComparison()
  const selected = hasJob(job)
  const label = selected ? `Bỏ ${job?.title || 'việc làm'} khỏi so sánh` : `Thêm ${job?.title || 'việc làm'} vào so sánh`

  function handleClick(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const result = toggleJob(job)
    if (result === 'limit') message.warning('Bạn chỉ có thể so sánh tối đa 3 việc làm.')
  }

  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={handleClick}
      className={`inline-flex shrink-0 items-center justify-center border text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.icon} ${
        selected
          ? 'border-emerald-300 bg-emerald-50 text-[var(--brand-primary)]'
          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-slate-50 hover:text-[var(--brand-primary)]'
      } ${className}`}
    >
      {selected
        ? <CheckOutlined aria-hidden="true" className="shrink-0" />
        : <SwapOutlined aria-hidden="true" className="shrink-0" />}
      {showLabel && (
        <span className={variant === 'reveal' ? 'min-w-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/compare:max-w-20 group-hover/compare:opacity-100 group-focus-visible/compare:max-w-20 group-focus-visible/compare:opacity-100 motion-reduce:transition-none' : ''}>
          {selected ? 'Đã thêm' : 'So sánh'}
        </span>
      )}
    </button>
  )

  if (showLabel) return button
  return <Tooltip title={selected ? 'Đã thêm vào so sánh' : 'Thêm vào so sánh'}>{button}</Tooltip>
}
