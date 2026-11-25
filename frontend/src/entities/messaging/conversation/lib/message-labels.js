import { m } from '@/shared/config/i18n'

const KIND_PREVIEWS = {
  job: m.connect_preview_job,
  cv: m.connect_preview_cv,
  file: m.connect_preview_file,
  image: m.connect_preview_image,
  interview: m.connect_preview_interview,
  system: m.connect_preview_system,
}

/** One line for a list row or a toast: text as is, other kinds by label. */
export function messagePreview(message, { myRole } = {}) {
  if (!message) return ''
  const text = message.kind === 'text'
    ? (message.preview ?? message.body ?? '').replace(/\s+/g, ' ').trim()
    : (KIND_PREVIEWS[message.kind] || m.connect_preview_system)()
  return myRole && message.sender_role === myRole ? m.connect_preview_you({ text }) : text
}

const LOCKED_REASONS = {
  unavailable: m.connect_locked_unavailable,
  blocked: m.connect_locked_blocked,
  withdrawn: m.connect_locked_withdrawn,
  account: m.connect_locked_account,
  disabled: m.connect_locked_disabled,
}

export function lockedReasonText(reason) {
  return (LOCKED_REASONS[reason] || m.connect_locked_unavailable)()
}

export const INTERVIEW_MODES = [
  ['onsite', m.connect_interview_mode_onsite],
  ['online', m.connect_interview_mode_online],
  ['phone', m.connect_interview_mode_phone],
]
const MODE_LABELS = Object.fromEntries(INTERVIEW_MODES)

export function interviewModeLabel(mode) {
  return MODE_LABELS[mode]?.() || mode || ''
}

// Chấm trạng thái: xám khi chờ/đã xong, màu nhấn khi đã nhận, đỏ trầm khi từ chối/hủy.
const INTERVIEW_STATUSES = {
  proposed: [m.connect_interview_status_proposed, 'fog'],
  accepted: [m.connect_interview_status_accepted, 'accent'],
  declined: [m.connect_interview_status_declined, 'danger'],
  reschedule_requested: [m.connect_interview_status_reschedule_requested, 'slate'],
  cancelled: [m.connect_interview_status_cancelled, 'danger'],
  superseded: [m.connect_interview_status_superseded, 'fog'],
  completed: [m.connect_interview_status_completed, 'fog'],
}

/** `{ label, tone }` — tone is fog, accent, slate or danger (a 6px dot + text). */
export function interviewStatusTag(status) {
  const [label, tone] = INTERVIEW_STATUSES[status] || [() => status || '', 'fog']
  return { label: label(), tone }
}

const SYSTEM_EVENTS = {
  started: () => m.connect_system_started(),
  interview_accepted: (actor) => m.connect_system_interview_accepted({ actor }),
  interview_declined: (actor) => m.connect_system_interview_declined({ actor }),
  interview_reschedule_requested: (actor) => m.connect_system_interview_reschedule_requested({ actor }),
  interview_cancelled: (actor) => m.connect_system_interview_cancelled({ actor }),
  interview_completed: (actor) => m.connect_system_interview_completed({ actor }),
  handover: () => m.connect_system_handover(),
}

function actorLabel(actorRole, myRole) {
  if (actorRole && actorRole === myRole) return m.connect_actor_you()
  if (actorRole === 'recruiter') return m.connect_actor_recruiter()
  if (actorRole === 'candidate') return m.connect_actor_candidate()
  return m.connect_actor_system()
}

/** Sentence for a `kind=system` message, in the viewer's words ("Bạn đã…"). */
export function systemMessageText(message, myRole) {
  const event = message?.system?.event
  const render = SYSTEM_EVENTS[event]
  if (render) return render(actorLabel(message.system.actor_role, myRole))
  return message?.body || m.connect_preview_system()
}
