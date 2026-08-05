import {
  CheckCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from '@ant-design/icons'
import { useState } from 'react'

const NOTICE_TONES = {
  eligible: {
    Icon: CheckCircleFilled,
    container: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-white text-emerald-600 ring-emerald-100',
    title: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  free: {
    Icon: InfoCircleFilled,
    container: 'border-sky-200 bg-sky-50',
    icon: 'bg-white text-sky-600 ring-sky-100',
    title: 'text-sky-900',
    badge: 'bg-sky-100 text-sky-700',
  },
  blocked: {
    Icon: ExclamationCircleFilled,
    container: 'border-amber-200 bg-amber-50',
    icon: 'bg-white text-amber-600 ring-amber-100',
    title: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
}

function noticeContent(postingContext) {
  const remaining = postingContext.publish_remain ?? postingContext.free_publish_remain
  const limit = postingContext.publish_limit ?? postingContext.free_publish_limit
  const remainingLabel = remaining == null || limit == null ? 'Chưa xác định' : `${remaining}/${limit}`
  const eligibleDescription = `Còn ${remainingLabel} lượt đăng tin · Tài khoản xác thực Cấp 3.`

  if (!postingContext.job_postable) {
    return {
      state: 'blocked',
      title: postingContext.block_reason,
      badge: null,
      description: postingContext.verified_job_quota_eligible
        ? eligibleDescription
        : 'Bạn vẫn có thể lưu bản nháp. Hoàn tất xác thực Cấp 3 để mở hạn mức đăng tin.',
    }
  }

  if (postingContext.verified_job_quota_eligible) {
    return {
      state: 'eligible',
      title: 'Hạn mức đăng tin',
      badge: 'Đã mở',
      description: eligibleDescription,
    }
  }

  return {
    state: 'free',
    title: 'Hạn mức miễn phí',
    badge: 'Đang sử dụng',
    description: `Còn ${remainingLabel} lượt miễn phí. Hoàn tất xác thực Cấp 3 để mở hạn mức mở rộng.`,
  }
}

export default function PostingQuotaNotice({ postingContext }) {
  const [visible, setVisible] = useState(true)

  if (!postingContext || !visible) return null

  const content = noticeContent(postingContext)
  const tone = NOTICE_TONES[content.state]
  const Icon = tone.Icon
  const dismissible = content.state !== 'blocked'

  return (
    <section
      aria-label="Hạn mức đăng tin"
      data-quota-state={content.state}
      className={`rounded-xl border px-3 py-2.5 shadow-xs sm:px-4 ${tone.container}`}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-3">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ring-1 ${tone.icon}`}
        >
          <Icon />
        </span>
        <div
          role={content.state === 'blocked' ? 'alert' : 'status'}
          aria-live={content.state === 'blocked' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-x-3"
        >
          <span className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <strong className={`block text-sm font-bold leading-5 ${tone.title}`}>
              {content.title}
            </strong>
            {content.badge && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${tone.badge}`}>
                {content.badge}
              </span>
            )}
          </span>
          <p className="mt-0.5 break-words text-xs leading-5 text-slate-600 sm:mt-0">
            {content.description}
          </p>
        </div>
        {dismissible && (
          <button
            type="button"
            aria-label="Đóng thông báo quota đăng tin"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            onClick={() => setVisible(false)}
          >
            <CloseOutlined />
          </button>
        )}
      </div>
    </section>
  )
}
