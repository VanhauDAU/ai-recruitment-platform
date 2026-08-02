export const STATUS_BADGE_CLASSES = {
  submitted: 'border-slate-200 bg-slate-50 text-slate-600',
  viewed: 'border-slate-200 bg-slate-50 text-slate-600',
  considering: 'border-slate-200 bg-slate-50 text-slate-600',
  shortlisted: 'border-slate-200 bg-slate-50 text-slate-600',
  interviewed: 'border-slate-200 bg-slate-50 text-slate-600',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-slate-200 bg-slate-100 text-slate-500',
}

const STATUS_TRANSITIONS = {
  submitted: ['viewed', 'considering', 'shortlisted', 'interviewed', 'rejected', 'accepted'],
  viewed: ['considering', 'shortlisted', 'interviewed', 'rejected', 'accepted'],
  considering: ['shortlisted', 'interviewed', 'rejected', 'accepted'],
  shortlisted: ['interviewed', 'rejected', 'accepted'],
  interviewed: ['rejected', 'accepted'],
  accepted: [],
  rejected: [],
}

function timestampOf(application) {
  const value = application.applied_at || application.submitted_at
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
      candidateName: application.candidate_name || application.candidate_email || 'Ứng viên',
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

export function availableStatusOptions(currentStatus, restricted, statuses) {
  if (!currentStatus) return statuses
  const legalTransitions = STATUS_TRANSITIONS[currentStatus] || []
  const allowed = restricted
    ? legalTransitions.filter((value) => value === 'rejected')
    : legalTransitions
  return statuses.filter(([value]) => value === currentStatus || allowed.includes(value))
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
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
