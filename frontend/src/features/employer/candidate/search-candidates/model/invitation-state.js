import { m } from '@/shared/config/i18n'

/** Nhãn trạng thái của ứng viên với tin đang tìm; null khi chưa ứng tuyển, chưa mời. */
export function candidateStateLabel(candidate) {
  if (candidate.applied) return m.employer_workspace_search_applied()
  if (candidate.invitation_status === 'accepted') return m.employer_workspace_search_connected()
  if (candidate.invitation_status === 'declined') return m.employer_workspace_search_declined()
  return candidate.invited ? m.employer_workspace_search_invited() : null
}
