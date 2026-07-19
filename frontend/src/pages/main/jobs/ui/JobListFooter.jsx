import { useState } from 'react'
import { BellOutlined } from '@ant-design/icons'
import { submitFeedback } from '@/features/submit-feedback'
import { message } from '@/shared/lib/toast'

// Cụm cuối danh sách kết quả (kiểu TopCV, hiện cả khi có lẫn không có kết quả):
// chip danh mục nghề liên quan -> box đăng ký thông báo -> khảo sát hài lòng
// -> đoạn giới thiệu theo ngành (chỉ khi đang lọc đúng một nhánh danh mục).
export default function JobListFooter({ relatedCategories, onCategorySelect, catChain }) {
  return (
    <div className="mt-6 space-y-4">
      {relatedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-600">Danh mục Nghề liên quan:</span>
          {relatedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategorySelect(category.id)}
              className="cursor-pointer rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">📬</span>
          <div>
            <p className="text-sm font-bold text-gray-800">Bạn vẫn chưa tìm được công việc ưng ý?</p>
            <p className="mt-0.5 text-sm text-gray-600">Đăng ký nhận thông báo ngay để không bỏ lỡ cơ hội mới nhất.</p>
          </div>
        </div>
        <span
          title="Sắp ra mắt"
          className="inline-flex w-fit shrink-0 cursor-not-allowed items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white opacity-90"
        >
          <BellOutlined /> Nhận thông báo
        </span>
      </div>

      <SatisfactionSurvey />

      {catChain.length >= 2 && (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm leading-6 text-gray-700">
          <span className="font-semibold text-[var(--brand-primary)]">{catChain.at(-1).name}</span>{' '}
          là chuyên môn được nhiều doanh nghiệp uy tín ưu tiên tuyển dụng. Bạn có thể dễ dàng
          tìm thấy việc làm thuộc chuyên môn này trong danh mục nghề{' '}
          <span className="font-semibold">{catChain.at(-2).name}</span>
          {catChain.length >= 3 && (
            <> thuộc nhóm nghề <span className="font-semibold">{catChain[0].name}</span></>
          )}
          {' '}trên ProCV.
        </p>
      )}
    </div>
  )
}

const SATISFACTION_OPTIONS = [
  ['very_unsatisfied', '😡', 'Rất tệ'],
  ['unsatisfied', '🙁', 'Tệ'],
  ['neutral', '😐', 'Bình thường'],
  ['satisfied', '🙂', 'Tốt'],
  ['very_satisfied', '🤩', 'Tuyệt vời'],
]

// Đánh giá 1 chạm: gửi qua API góp ý sẵn có (content tự sinh vì API yêu cầu).
function SatisfactionSurvey() {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  async function rate(satisfaction, label) {
    if (sending) return
    setSending(true)
    try {
      await submitFeedback({
        category: 'ui_ux',
        content: `Đánh giá nhanh trải nghiệm tìm việc: ${label}.`,
        satisfaction,
        page_url: `${window.location.pathname}${window.location.search}`,
      })
      setSubmitted(true)
    } catch {
      message.error('Chưa gửi được đánh giá. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      {submitted ? (
        <p className="text-sm font-semibold text-[var(--brand-primary)]">Cảm ơn bạn đã đánh giá! Góp ý của bạn giúp ProCV tốt hơn mỗi ngày. 💚</p>
      ) : (
        <>
          <p className="text-sm font-bold text-gray-800">Bạn có hài lòng với trải nghiệm tìm việc trên ProCV không?</p>
          <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
            {SATISFACTION_OPTIONS.map(([value, emoji, label]) => (
              <button
                key={value}
                type="button"
                disabled={sending}
                onClick={() => rate(value, label)}
                className="flex w-[72px] cursor-pointer flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 transition hover:border-[var(--brand-primary)] hover:bg-green-50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="text-xl grayscale transition group-hover:grayscale-0">{emoji}</span>
                <span className="text-xs text-gray-600">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
