import { useState } from 'react'
import { message } from '@/shared/lib/toast'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import AnimatedEmoji from '@/shared/ui/AnimatedEmoji'
import './job-rating.css'

const RATING_OPTIONS = [
  { value: 1, label: 'Không đáng tin cậy & rõ ràng', emoji: 'crying', tone: '#e11d48', toneText: '#be123c' },
  { value: 2, label: 'Ít đáng tin cậy & rõ ràng', emoji: 'sad', tone: '#f97316', toneText: '#c2410c' },
  { value: 3, label: 'Bình thường', emoji: 'neutral', tone: '#64748b', toneText: '#475569' },
  { value: 4, label: 'Đáng tin cậy & rõ ràng', emoji: 'happy', tone: '#10b981', toneText: '#047857' },
  { value: 5, label: 'Rất đáng tin cậy & rõ ràng', emoji: 'star-struck', tone: '#f59e0b', toneText: '#b45309' },
]

const toneStyle = (option) => option && { '--tone': option.tone, '--tone-text': option.toneText }

function RatingEmoji({ name, animated, className = 'job-rating__emoji' }) {
  return <AnimatedEmoji name={name} animated={animated} className={className} />
}

const ISSUE_OPTIONS = [
  'Mô tả công việc không rõ ràng, đọc xong không hiểu rõ nhiệm vụ cần phải làm gì',
  'Tin đăng có nhiều lỗi chính tả, trình bày cẩu thả.',
  'Không có thông tin thời gian làm việc hoặc thông tin mâu thuẫn',
  'Thiếu địa chỉ chi tiết trong địa điểm làm việc.',
  'Mức lương không đáng tin cậy: ghim khoảng quá rộng hoặc thu nhập cao bất thường.',
  'Không nên để lương là "Thỏa thuận" cho vị trí này',
  'Ứng tuyển nhưng nhà tuyển dụng không xem CV',
  'Công ty này đăng nhiều vị trí mà nội dung giống nhau.',
  'Lý do khác',
]

export default function JobQualityRating({ jobId }) {
  const storageKey = `job-quality-feedback:${jobId}`
  const [selected, setSelected] = useState(null)
  const [issues, setIssues] = useState([])
  const [hasSubmitted, setHasSubmitted] = useState(() => Boolean(
    jobId && window.localStorage.getItem(`job-quality-feedback:${jobId}`),
  ))
  const [showThanks, setShowThanks] = useState(false)
  const [hovered, setHovered] = useState(null)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const selectedOption = RATING_OPTIONS.find((option) => option.value === selected)
  const needsReason = selected !== null && selected <= 3
  const canSubmit = selected !== null && (!needsReason || issues.length > 0)

  function selectRating(value) {
    setSelected(value)
    if (value > 3) setIssues([])
  }

  function toggleIssue(issue) {
    setIssues((current) => current.includes(issue)
      ? current.filter((item) => item !== issue)
      : [...current, issue])
  }

  function submitRating() {
    if (!canSubmit) return
    window.localStorage.setItem(storageKey, JSON.stringify({ rating: selected, issues, submittedAt: Date.now() }))
    setHasSubmitted(true)
    setShowThanks(true)
    message.success('Cảm ơn bạn đã gửi phản hồi về tin tuyển dụng này.')
  }

  if (hasSubmitted) {
    if (!showThanks) return null
    return (
      <section className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] p-5 text-center shadow-sm sm:p-6">
        <RatingEmoji name={selectedOption?.emoji || 'happy'} animated={!reduceMotion} className="job-rating__emoji job-rating__thanks-emoji" />
        <h2 className="mt-3 text-base font-bold text-slate-800">Cảm ơn bạn đã đánh giá</h2>
        <p className="mt-1 text-sm text-slate-600">Phản hồi của bạn giúp cải thiện chất lượng tin tuyển dụng.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">Đánh giá tin tuyển dụng</h2>
      <p className="mt-4 text-sm text-slate-600">Bạn thấy độ tin cậy và rõ ràng của tin tuyển dụng này thế nào?</p>
      <div className={`job-rating__options${selected ? ' has-selection' : ''}`}>
        {RATING_OPTIONS.map((option) => {
          const active = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => selectRating(option.value)}
              onPointerEnter={() => setHovered(option.value)}
              onPointerLeave={() => setHovered(null)}
              className={`job-rating__option${active ? ' is-active' : ''}`}
              style={toneStyle(option)}
            >
              <RatingEmoji name={option.emoji} animated={!reduceMotion && (active || hovered === option.value)} />
              <span className="job-rating__label">{option.label}</span>
            </button>
          )
        })}
      </div>
      <p className="job-rating__caption" aria-hidden="true" style={toneStyle(selectedOption)}>
        {selectedOption?.label || 'Chạm biểu tượng để chọn mức đánh giá'}
      </p>
      {needsReason && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700">Những điểm nào trên tin tuyển dụng bạn đang thấy không đủ tin cậy và rõ ràng? <span className="text-red-500">*</span></p>
          <div className="mt-3 space-y-2.5">
            {ISSUE_OPTIONS.map((issue) => (
              <label key={issue} className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-slate-600">
                <input type="checkbox" checked={issues.includes(issue)} onChange={() => toggleIssue(issue)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[var(--brand-primary)]" />
                <span>{issue}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-center sm:justify-end">
        <button type="button" disabled={!canSubmit} onClick={submitRating} className="h-10 cursor-pointer rounded-full bg-[var(--brand-primary)] px-6 text-sm font-bold text-white transition enabled:hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          Gửi phản hồi
        </button>
      </div>
    </section>
  )
}
