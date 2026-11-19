import { m } from '@/shared/config/i18n'

// Mirrors `Application.Status`: `submitted`/`viewed` are recorded by the
// system, the recruiter answers with one of APPLICATION_DECISION_STATUSES.
export const RECRUITER_APPLICATION_STATUSES = [
  ['submitted', m.application_status_new()], ['viewed', m.application_status_viewed()], ['shortlisted', m.application_status_shortlisted()],
  ['interviewed', m.application_status_interviewed()], ['accepted', m.application_status_accepted()], ['rejected', m.application_status_rejected()],
  ['withdrawn', m.application_status_withdrawn()],
]

export const RECRUITER_APPLICATION_STATUS_LABELS = Object.fromEntries(RECRUITER_APPLICATION_STATUSES)

// Which decisions are allowed right now comes from the API (`available_decisions`).
export const APPLICATION_DECISION_STATUSES = ['shortlisted', 'interviewed', 'accepted', 'rejected']
export const TERMINAL_APPLICATION_STATUSES = ['accepted', 'rejected', 'withdrawn']

// Tone names; each surface maps them onto its own CSS (`*-tone-<name>`).
export const APPLICATION_STATUS_TONES = {
  submitted: 'sky',
  viewed: 'cyan',
  shortlisted: 'emerald',
  interviewed: 'violet',
  accepted: 'teal',
  rejected: 'slate',
  withdrawn: 'slate',
}

// Nhãn ngắn cho bộ lọc ở trang "Việc làm đã ứng tuyển"; nhãn dài bên dưới dùng cho mốc tiến trình.
export const CANDIDATE_APPLICATION_FILTERS = [
  ['submitted', m.application_candidate_filter_submitted()], ['viewed', m.application_status_viewed()], ['shortlisted', m.application_status_shortlisted()],
  ['interviewed', m.application_status_interviewed()], ['accepted', m.application_status_accepted()], ['rejected', m.application_candidate_filter_rejected()],
  ['withdrawn', m.application_candidate_filter_withdrawn()],
]

export const CANDIDATE_APPLICATION_STATUS_LABELS = {
  submitted: m.application_candidate_status_submitted(),
  viewed: m.application_candidate_status_viewed(),
  shortlisted: m.application_candidate_status_shortlisted(),
  interviewed: m.application_candidate_status_interviewed(),
  accepted: m.application_status_accepted(),
  rejected: m.application_candidate_filter_rejected(),
  withdrawn: m.application_candidate_status_withdrawn(),
}

/** Replace one application inside every cached recruiter list page. */
export function replaceApplicationInPage(page, application) {
  if (!page?.results) return page
  return {
    ...page,
    results: page.results.map((item) => (
      item.public_id === application.public_id ? { ...item, ...application } : item
    )),
  }
}

// Mirrors ApplicationReview.Recommendation.
export const REVIEW_RECOMMENDATIONS = [
  { value: 'strong_yes', label: m.application_review_strong_yes(), tone: 'emerald' },
  { value: 'yes', label: m.application_review_yes(), tone: 'teal' },
  { value: 'no', label: m.application_review_no(), tone: 'amber' },
  { value: 'strong_no', label: m.application_review_strong_no(), tone: 'rose' },
]

// Mirrors CandidateBlock.Reason.
export const CANDIDATE_BLOCK_REASONS = [
  { value: 'spam', label: m.application_block_spam() },
  { value: 'inappropriate', label: m.application_block_inappropriate() },
  { value: 'fake_profile', label: m.application_block_fake_profile() },
  { value: 'other', label: m.application_block_other() },
]
