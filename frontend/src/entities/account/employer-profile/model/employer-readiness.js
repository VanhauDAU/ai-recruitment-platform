import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_COMPLETE_PROFILE_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
  employerMarketingPath,
} from '@/shared/config/portals'

export const EMPLOYER_CAPABILITIES = Object.freeze({
  JOB_WORKSPACE: 'job_workspace',
  VERIFICATION: 'verification',
  CANDIDATE_DATA: 'candidate_data',
  JOB_APPROVAL: 'job_approval',
})

export const EMPLOYER_DPA_STATUSES = Object.freeze([
  'missing',
  'current',
  'legacy_unversioned',
  'outdated',
  'grace',
  'hold',
  'unknown',
])

export const EMPLOYER_READINESS_FIELDS = Object.freeze([
  'job_workspace_ready',
  'verification_approved',
  'candidate_data_access',
  'dpa_status',
  'blockers',
])

const CAPABILITY_VALUES = new Set(Object.values(EMPLOYER_CAPABILITIES))
const DPA_STATUS_VALUES = new Set(EMPLOYER_DPA_STATUSES)
const MACHINE_VALUE = /^[a-z][a-z0-9_]*$/

const ACTIONS = Object.freeze({
  complete_onboarding: {
    label: 'Hoàn tất hồ sơ đăng ký',
    to: EMPLOYER_COMPLETE_PROFILE_URL,
  },
  verify_phone: {
    label: 'Xác thực số điện thoại',
    to: EMPLOYER_PHONE_VERIFY_URL,
  },
  link_company: {
    label: 'Liên kết công ty',
    to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`,
  },
  upload_business_document: {
    label: 'Nộp giấy tờ doanh nghiệp',
    to: EMPLOYER_BUSINESS_LICENSE_URL,
  },
  upload_candidate_dpa: {
    label: 'Nộp văn bản xử lý dữ liệu',
    to: EMPLOYER_DATA_PROTECTION_URL,
  },
  accept_dpa: {
    label: 'Chấp thuận DPA',
    to: EMPLOYER_DATA_PROTECTION_URL,
  },
  accept_current_dpa: {
    label: 'Cập nhật DPA hiện hành',
    to: EMPLOYER_DATA_PROTECTION_URL,
  },
  open_verification: {
    label: 'Xem trạng thái xác thực',
    to: EMPLOYER_VERIFY_URL,
  },
  contact_support: {
    label: 'Liên hệ hỗ trợ',
    to: employerMarketingPath('/lien-he'),
  },
})

const INVALID_READINESS_BLOCKER = Object.freeze({
  code: 'readiness_contract_invalid',
  capabilities: Object.freeze(Object.values(EMPLOYER_CAPABILITIES)),
  message: 'Không thể xác minh quyền truy cập từ dữ liệu hiện tại.',
  action: 'contact_support',
})

function hasOwn(value, key) {
  return Boolean(value && typeof value === 'object' && Object.hasOwn(value, key))
}

function isBlocker(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.code === 'string'
    && MACHINE_VALUE.test(value.code)
    && Array.isArray(value.capabilities)
    && value.capabilities.length > 0
    && value.capabilities.every((capability) => CAPABILITY_VALUES.has(capability))
    && typeof value.message === 'string'
    && value.message.trim()
    && typeof value.action === 'string'
    && MACHINE_VALUE.test(value.action),
  )
}

function hasCapabilityBlocker(blockers, capability) {
  return blockers.some((blocker) => blocker.capabilities.includes(capability))
}

function canonicalContractIsValid(profile) {
  if (
    typeof profile.job_workspace_ready !== 'boolean'
    || typeof profile.verification_approved !== 'boolean'
    || typeof profile.candidate_data_access !== 'boolean'
    || !DPA_STATUS_VALUES.has(profile.dpa_status)
    || !Array.isArray(profile.blockers)
    || !profile.blockers.every(isBlocker)
  ) return false

  const blockers = profile.blockers
  if (
    profile.job_workspace_ready
    && hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.JOB_WORKSPACE)
  ) return false
  if (
    profile.verification_approved
    && hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.VERIFICATION)
  ) return false
  if (
    profile.candidate_data_access
    && hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.CANDIDATE_DATA)
  ) return false
  if (
    !profile.job_workspace_ready
    && !hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.JOB_WORKSPACE)
  ) return false
  if (
    !profile.verification_approved
    && !hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.VERIFICATION)
  ) return false
  if (
    !profile.candidate_data_access
    && !hasCapabilityBlocker(blockers, EMPLOYER_CAPABILITIES.CANDIDATE_DATA)
  ) return false
  if (
    profile.candidate_data_access
    && (
      !profile.job_workspace_ready
      || !profile.verification_approved
      || profile.dpa_status !== 'current'
    )
  ) return false
  if (
    profile.job_workspace_ready
    && ['missing', 'hold', 'unknown'].includes(profile.dpa_status)
  ) return false

  return true
}

function invalidReadiness() {
  return {
    source: 'invalid',
    contractValid: false,
    jobWorkspaceReady: false,
    verificationApproved: false,
    candidateDataAccess: false,
    dpaStatus: 'unknown',
    blockers: [{ ...INVALID_READINESS_BLOCKER }],
  }
}

function legacyReadiness(profile) {
  const jobWorkspaceReady = profile?.onboarding?.verification_completed === true
  const blocker = jobWorkspaceReady
    ? {
        code: 'canonical_readiness_required',
        capabilities: [
          EMPLOYER_CAPABILITIES.VERIFICATION,
          EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
          EMPLOYER_CAPABILITIES.JOB_APPROVAL,
        ],
        message: 'Cần tải trạng thái xác thực mới trước khi xem dữ liệu ứng viên.',
        action: 'open_verification',
      }
    : {
        code: 'legacy_verification_required',
        capabilities: [
          EMPLOYER_CAPABILITIES.JOB_WORKSPACE,
          EMPLOYER_CAPABILITIES.VERIFICATION,
          EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
          EMPLOYER_CAPABILITIES.JOB_APPROVAL,
        ],
        message: 'Hoàn tất các bước xác thực để sử dụng workspace tuyển dụng.',
        action: 'open_verification',
      }

  return {
    source: 'legacy',
    contractValid: true,
    jobWorkspaceReady,
    verificationApproved: false,
    candidateDataAccess: false,
    dpaStatus: 'unknown',
    blockers: [blocker],
  }
}

export function resolveEmployerReadiness(profile) {
  const canonicalFieldCount = EMPLOYER_READINESS_FIELDS.filter((field) => (
    hasOwn(profile, field)
  )).length

  if (canonicalFieldCount === 0) return legacyReadiness(profile)
  if (
    canonicalFieldCount !== EMPLOYER_READINESS_FIELDS.length
    || !canonicalContractIsValid(profile)
  ) return invalidReadiness()

  return {
    source: 'canonical',
    contractValid: true,
    jobWorkspaceReady: profile.job_workspace_ready,
    verificationApproved: profile.verification_approved,
    candidateDataAccess: profile.candidate_data_access,
    dpaStatus: profile.dpa_status,
    blockers: profile.blockers.map((blocker) => ({
      ...blocker,
      capabilities: [...blocker.capabilities],
    })),
  }
}

export function employerReadinessBlockersFor(readiness, capability) {
  return (readiness?.blockers || []).filter((blocker) => (
    blocker.capabilities.includes(capability)
  ))
}

export function employerReadinessAction(action) {
  return ACTIONS[action] || ACTIONS.contact_support
}

export function resolveEmployerSessionWorkspaceReady(user) {
  if (hasOwn(user, 'employer_job_workspace_ready')) {
    return user.employer_job_workspace_ready === true
  }
  return user?.employer_verification_completed === true
}
