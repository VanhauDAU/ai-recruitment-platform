import { m } from '@/shared/config/i18n'

/**
 * Quick-pick reasons for verification, company-update and domain decisions.
 * They only pre-fill the reason field; the admin can always edit the text.
 */
export const DOCUMENT_REVIEW_REASONS = {
  changes_requested: [
    m.admin_reason_doc_blurry(),
    m.admin_reason_doc_expired(),
    m.admin_reason_doc_mismatch(),
    m.admin_reason_doc_incomplete(),
  ],
  rejected: [
    m.admin_reason_doc_wrong_type(),
    m.admin_reason_doc_forged(),
  ],
}

export const CASE_DECISION_REASONS = {
  approved: [m.admin_reason_case_complete()],
  changes_requested: [
    m.admin_reason_case_missing(),
    m.admin_reason_case_mismatch(),
    m.admin_reason_case_authorization(),
  ],
  rejected: [
    m.admin_reason_case_not_representative(),
    m.admin_reason_case_closed(),
    m.admin_reason_case_forged(),
  ],
  revoked: [m.admin_reason_revoke_requested(), m.admin_reason_revoke_invalid()],
  expired: [m.admin_reason_expire_authorization()],
  unlock: [m.admin_reason_unlock_appeal()],
}

export const COMPANY_UPDATE_REASONS = {
  approved: [m.admin_reason_update_checked()],
  changes_requested: [
    m.admin_reason_update_missing_proof(),
    m.admin_reason_update_mismatch(),
  ],
  rejected: [m.admin_reason_update_no_basis()],
}

export const DOMAIN_REVIEW_REASONS = {
  approve_manual: [m.admin_reason_domain_checked()],
  reject_manual: [m.admin_reason_domain_not_owned(), m.admin_reason_domain_no_proof()],
  revoke: [m.admin_reason_domain_unused()],
}
