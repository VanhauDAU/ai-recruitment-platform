import { getIntlLocale, m } from '@/shared/config/i18n'
function timestampOf(application) {
  const value = application.applied_at
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function candidateKey(application) {
  const email = application.candidate_email?.trim().toLocaleLowerCase('vi-VN')
  // The list API does not expose a candidate id. Email is the only stable
  // identity available; without it, keep records separate to avoid merging
  // unrelated candidates who happen to share a display name.
  return email ? `email:${email}` : `application:${application.public_id}`
}

export function groupApplicationsByCandidate(applications = []) {
  const groups = new Map()

  applications.forEach((application) => {
    const key = candidateKey(application)
    const current = groups.get(key) || {
      key,
      candidateName: application.candidate_name || application.candidate_email || m.employer_workspace_app_candidate_fallback(),
      candidateEmail: application.candidate_email || '',
      restricted: Boolean(application.candidate_account_restricted),
      applications: [],
    }
    current.applications.push(application)
    current.restricted ||= Boolean(application.candidate_account_restricted)
    groups.set(key, current)
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      applications: [...group.applications].sort((left, right) => timestampOf(right) - timestampOf(left)),
    }))
    .sort((left, right) => timestampOf(right.applications[0]) - timestampOf(left.applications[0]))
}

export function documentFromVersion(version) {
  if (!version) return null
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

export function formatApplicationDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(getIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function initialsOf(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word[0]).join('').toLocaleUpperCase('vi-VN') || 'UV'
}

/** The decision the recruiter can still undo: its notice has not been delivered. */
export function pendingNoticeOf(history = []) {
  const row = history.find((item) => item.can_undo)
  return row ? { deliver_at: row.candidate_notice.deliver_at } : null
}
