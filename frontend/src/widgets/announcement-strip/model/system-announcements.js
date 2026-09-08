import {
  ANNOUNCEMENT_ANIMATIONS,
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_SURFACES,
} from '@/entities/announcement'
import {
  EMPLOYER_CAPABILITIES,
  employerReadinessAction,
  employerReadinessBlockersFor,
} from '@/entities/employer-profile'

const LOCKED = Object.freeze({
  mode: ANNOUNCEMENT_DISMISS_MODES.LOCKED,
  snoozeSeconds: null,
  version: 1,
})

function systemItem(overrides) {
  return {
    revision: 1,
    source: 'system',
    badge: '',
    animation: ANNOUNCEMENT_ANIMATIONS.STATIC,
    displaySeconds: 6,
    dismiss: LOCKED,
    ...overrides,
  }
}

function emailVerification({ locale, verificationPath }) {
  const english = locale?.toLowerCase().startsWith('en')
  return systemItem({
    id: 'system-email-verification',
    kind: ANNOUNCEMENT_KINDS.SECURITY,
    priorityTier: 2,
    priority: 1000,
    icon: ANNOUNCEMENT_ICONS.LOCK,
    badge: english ? 'Security' : 'Bảo mật',
    message: english
      ? 'Your account email has not been verified.'
      : 'Tài khoản của bạn chưa được xác thực email.',
    cta: {
      label: english ? 'Verify now' : 'Xác thực ngay',
      url: verificationPath,
      external: false,
    },
  })
}

function employerCompliance(locale, readiness) {
  const english = locale?.toLowerCase().startsWith('en')
  const blocker = employerReadinessBlockersFor(
    readiness,
    EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
  )[0]
  const action = employerReadinessAction(blocker?.action || 'accept_dpa')
  return systemItem({
    id: 'system-employer-data-compliance',
    kind: ANNOUNCEMENT_KINDS.COMPLIANCE,
    priorityTier: 3,
    priority: 1000,
    icon: ANNOUNCEMENT_ICONS.SHIELD,
    badge: english ? 'Important' : 'Quan trọng',
    message: blocker?.message || (english
      ? 'Complete the required verification before accessing candidate data.'
      : 'Hoàn thiện yêu cầu xác thực để truy cập dữ liệu ứng viên.'),
    cta: {
      label: english ? 'Review now' : action.label,
      url: action.to,
      external: false,
    },
  })
}

function jobPreferences() {
  return systemItem({
    id: 'system-candidate-job-preferences',
    kind: ANNOUNCEMENT_KINDS.INFO,
    priorityTier: 5,
    priority: 1000,
    icon: ANNOUNCEMENT_ICONS.SPARKLES,
    badge: 'Dành cho bạn',
    message: 'Hãy chia sẻ nhu cầu công việc để nhận gợi ý việc làm tốt nhất.',
    cta: {
      label: 'Cập nhật nhu cầu',
      url: '/onboard-user',
      external: false,
    },
    animation: ANNOUNCEMENT_ANIMATIONS.FADE,
  })
}

export function buildSystemAnnouncements({
  employerReadiness,
  employerReadinessReady,
  employerProfile,
  employerProfileReady,
  locale = 'vi',
  surface,
  user,
  verificationPath,
}) {
  const items = []
  if (user && !user.email_verified && verificationPath) {
    items.push(emailVerification({ locale, verificationPath }))
  }
  if (
    surface === ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE
    && (
      (employerReadinessReady && !employerReadiness?.candidateDataAccess)
      || (!employerReadiness && employerProfileReady && (
        !employerProfile?.onboarding?.candidate_dpa_submitted
        || !employerProfile?.onboarding?.dpa_accepted
      ))
    )
  ) {
    items.push(employerCompliance(locale, employerReadiness))
  }
  if (
    surface === ANNOUNCEMENT_SURFACES.CANDIDATE
    && user?.role === 'candidate'
    && user.email_verified
    && !user.job_preferences_configured
  ) {
    items.push(jobPreferences())
  }
  return items
}
