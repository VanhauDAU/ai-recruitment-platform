// Mirrors `Application.Status`: `submitted`/`viewed` are recorded by the
// system, the recruiter answers with one of APPLICATION_DECISION_STATUSES.
export const RECRUITER_APPLICATION_STATUSES = [
  ['submitted', 'Mới'], ['viewed', 'Đã xem'], ['shortlisted', 'Phù hợp'],
  ['interviewed', 'Phỏng vấn'], ['accepted', 'Trúng tuyển'], ['rejected', 'Không phù hợp'],
]

export const RECRUITER_APPLICATION_STATUS_LABELS = Object.fromEntries(RECRUITER_APPLICATION_STATUSES)

// Which decisions are allowed right now comes from the API (`available_decisions`).
export const APPLICATION_DECISION_STATUSES = ['shortlisted', 'interviewed', 'accepted', 'rejected']
export const TERMINAL_APPLICATION_STATUSES = ['accepted', 'rejected']

// Tone names; each surface maps them onto its own CSS (`*-tone-<name>`).
export const APPLICATION_STATUS_TONES = {
  submitted: 'sky',
  viewed: 'cyan',
  shortlisted: 'emerald',
  interviewed: 'violet',
  accepted: 'teal',
  rejected: 'slate',
}

// Nhãn ngắn cho bộ lọc ở trang "Việc làm đã ứng tuyển"; nhãn dài bên dưới dùng cho mốc tiến trình.
export const CANDIDATE_APPLICATION_FILTERS = [
  ['submitted', 'Đã nộp'], ['viewed', 'NTD đã xem'], ['shortlisted', 'Phù hợp'],
  ['interviewed', 'Phỏng vấn'], ['accepted', 'Trúng tuyển'], ['rejected', 'Chưa phù hợp'],
]

export const CANDIDATE_APPLICATION_STATUS_LABELS = {
  submitted: 'Đã nộp hồ sơ',
  viewed: 'Nhà tuyển dụng đã xem hồ sơ',
  shortlisted: 'Hồ sơ phù hợp',
  interviewed: 'Mời phỏng vấn',
  accepted: 'Trúng tuyển',
  rejected: 'Chưa phù hợp',
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
