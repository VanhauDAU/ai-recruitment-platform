import { CheckCircleFilled, MehOutlined, SmileOutlined, FrownOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { message } from '@/shared/lib/toast'

const RATING_OPTIONS = [
  { value: 1, label: 'Không đáng tin cậy & rõ ràng', icon: <FrownOutlined /> },
  { value: 2, label: 'Ít đáng tin cậy & rõ ràng', icon: <FrownOutlined /> },
  { value: 3, label: 'Bình thường', icon: <MehOutlined /> },
  { value: 4, label: 'Đáng tin cậy & rõ ràng', icon: <SmileOutlined /> },
  { value: 5, label: 'Rất đáng tin cậy & rõ ràng', icon: <CheckCircleFilled /> },
]

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
  const [submitted, setSubmitted] = useState(() => Boolean(
    jobId && window.localStorage.getItem(`job-quality-feedback:${jobId}`),
  ))
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
    setSubmitted(true)
    message.success('Cảm ơn bạn đã gửi phản hồi về tin tuyển dụng này.')
  }

  if (submitted) {
    return (
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-center shadow-sm sm:p-6">
        <CheckCircleFilled className="text-3xl text-[var(--brand-primary)]" />
        <h2 className="mt-3 text-base font-bold text-slate-800">Cảm ơn bạn đã đánh giá</h2>
        <p className="mt-1 text-sm text-slate-600">Phản hồi của bạn giúp cải thiện chất lượng tin tuyển dụng.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="border-l-4 border-[var(--brand-primary)] pl-3 text-base font-bold text-slate-800 sm:text-lg">Đánh giá tin tuyển dụng</h2>
      <p className="mt-4 text-sm text-slate-600">Bạn thấy độ tin cậy và rõ ràng của tin tuyển dụng này thế nào?</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {RATING_OPTIONS.map((option) => {
          const active = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectRating(option.value)}
              className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-2 text-center text-xs transition ${
                active
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary)]'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <span className="text-xl">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
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
