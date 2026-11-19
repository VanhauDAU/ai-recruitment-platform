import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminCompanies(params = {}, { signal } = {}) {
  return data(client.get('/admin/companies/', { params, signal }))
}

export function getAdminCompanySummary({ signal } = {}) {
  return data(client.get('/admin/companies/summary/', { signal }))
}

export function getAdminCompany(publicId, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/`, { signal }))
}

export function getAdminCompanyRecruiters(publicId, params = {}, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/recruiters/`, {
    params,
    signal,
  }))
}

export function getAdminCompanyPublicPage(publicId, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/public-page/`, { signal }))
}

/** `action` là `apply` (tạm ẩn) hoặc `release` (khôi phục); response cùng dạng với public-page. */
export function setAdminCompanyPolicyHold(publicId, { action, reason }) {
  return data(client.post(`/admin/companies/${publicId}/policy-hold/`, { action, reason }))
}

/** Join requests; `awaiting_admin=1` keeps those only an administrator can decide. */
export function getAdminCompanyJoinRequests(params = {}, { signal } = {}) {
  return data(client.get('/admin/company-join-requests/', { params, signal }))
}

export function decideAdminCompanyJoinRequest(publicId, decision) {
  return data(client.post(`/admin/company-join-requests/${publicId}/${decision}/`))
}

/** Only for a company without a verified owner; `recruiter` is the recruiter public_id. */
export function assignAdminCompanyOwner(publicId, { recruiter, reason }) {
  return data(client.post(`/admin/companies/${publicId}/assign-owner/`, { recruiter, reason }))
}

/** Nội dung trang công ty đã đăng, chờ hậu kiểm; `status` mặc định `unreviewed` (`all` để xem hết). */
export function getAdminCompanyContentChanges(params = {}, { signal } = {}) {
  return data(client.get('/admin/company-content-changes/', { params, signal }))
}

/** Đánh dấu đã xem; trả `{ count }`. */
export function markAdminCompanyContentChangesReviewed(publicIds) {
  return data(client.post('/admin/company-content-changes/mark-reviewed/', { public_ids: publicIds }))
}

/** Hoàn tác một thay đổi chưa xem; `requireReview` bật luôn duyệt trước cho công ty. */
export function revertAdminCompanyContentChange(publicId, { reason, requireReview = false }) {
  return data(client.post(`/admin/company-content-changes/${publicId}/revert/`, {
    reason,
    require_review: requireReview,
  }))
}

/** `action` là `require` (bật duyệt trước nội dung) hoặc `release`; response cùng dạng với public-page. */
export function setAdminCompanyContentReview(publicId, { action, reason }) {
  return data(client.post(`/admin/companies/${publicId}/content-review/`, { action, reason }))
}
