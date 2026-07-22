export const RECRUITER_APPLICATION_STATUSES = [
  ['submitted', 'Tiếp nhận'], ['viewed', 'Đã xem'], ['considering', 'Cân nhắc'],
  ['shortlisted', 'Phù hợp'], ['interviewed', 'Phỏng vấn'], ['accepted', 'Đã nhận offer'],
  ['rejected', 'Từ chối'],
]

export const RECRUITER_APPLICATION_STATUS_LABELS = Object.fromEntries(RECRUITER_APPLICATION_STATUSES)

export const CANDIDATE_APPLICATION_STATUS_LABELS = {
  submitted: 'Tiếp nhận',
  viewed: 'Nhà tuyển dụng đã xem hồ sơ',
  considering: 'Hồ sơ đang được xem xét',
  shortlisted: 'Hồ sơ đang được xem xét',
  interviewed: 'Phỏng vấn',
  accepted: 'Đã nhận offer',
  rejected: 'Chưa phù hợp',
}
