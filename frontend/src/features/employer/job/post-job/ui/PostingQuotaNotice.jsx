import {
  CheckCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from '@ant-design/icons'
import { useState } from 'react'
import { Link } from 'react-router'
import { employerReadinessAction } from '@/entities/account/employer-profile'
import { m } from '@/shared/config/i18n'

const NOTICE_TONES = {
  eligible: {
    Icon: CheckCircleFilled,
    container: 'border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]',
    icon: 'bg-white text-[var(--brand-primary)] ring-[var(--brand-primary)]/15',
    title: 'text-[var(--brand-primary-hover)]',
    badge: 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)]',
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

// `publish_blockers` codes of the posting context -> readiness fix actions.
const BLOCKER_ACTIONS = {
  verification_required: 'open_verification',
  dpa_outdated: 'accept_current_dpa',
  compliance_hold_active: 'contact_support',
}

function noticeContent(postingContext) {
  const remaining = postingContext.publish_remain
  const limit = postingContext.publish_limit
  const remainingLabel = remaining == null || limit == null ? m.employer_job_quota_unknown() : `${remaining}/${limit}`
  const eligibleDescription = m.employer_job_quota_eligible_description({ remaining: remainingLabel })

  const blockers = postingContext.publish_blockers || []
  if (!postingContext.job_postable) {
    if (blockers.length) {
      return {
        state: 'blocked',
        title: m.employer_job_quota_blocked_title(),
        badge: null,
        description: m.employer_job_quota_blocked_with_blockers(),
        blockers,
      }
    }
    return {
      state: 'blocked',
      title: postingContext.block_reason,
      badge: null,
      description: postingContext.verified_job_quota_eligible
        ? eligibleDescription
        : m.employer_job_quota_blocked_unverified(),
    }
  }

  if (postingContext.verified_job_quota_eligible) {
    return {
      state: 'eligible',
      title: m.employer_job_quota_title(),
      badge: m.employer_job_quota_unlocked(),
      description: eligibleDescription,
    }
  }

  return {
    state: 'free',
    title: m.employer_job_quota_free_title(),
    badge: m.employer_job_quota_in_use(),
    description: postingContext.verified_publish_limit
      ? m.employer_job_quota_free_with_limit({ remaining: remainingLabel, limit: postingContext.verified_publish_limit })
      : m.employer_job_quota_free_extended({ remaining: remainingLabel }),
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
      aria-label={m.employer_job_quota_title()}
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
          {content.blockers && (
            <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-700">
              {content.blockers.map((blocker) => {
                const action = employerReadinessAction(BLOCKER_ACTIONS[blocker.code])
                return (
                  <li key={blocker.code}>
                    {blocker.label}{' '}
                    <Link className="font-semibold" to={action.to}>{action.label}</Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            aria-label={m.employer_job_quota_dismiss()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/25 focus-visible:ring-offset-1"
            onClick={() => setVisible(false)}
          >
            <CloseOutlined />
          </button>
        )}
      </div>
    </section>
  )
}
