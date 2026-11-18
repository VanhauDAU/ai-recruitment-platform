import api from '@/shared/api/client'

const PAGE_URL = '/employer/company/page/'

/** Workspace "Trang công ty": quyền, registry, bố cục, nội dung xem trước. 404 khi chưa liên kết công ty. */
export async function getEmployerCompanyPage({ signal } = {}) {
  const { data } = await api.get(PAGE_URL, { signal })
  return data
}

/** `payload` gồm `lock_version` và chỉ những trường bố cục thay đổi; trả lại toàn bộ workspace. */
export async function updateEmployerCompanyPageLayout(payload) {
  const { data } = await api.patch(`${PAGE_URL}layout/`, payload)
  return data
}

/**
 * Gộp `changes` (chỉ các khoá nội dung đã đổi, kèm cờ `*_pending` khi sẽ tải ảnh)
 * vào yêu cầu cập nhật đang mở của người gọi; trả lại toàn bộ workspace.
 */
export async function submitEmployerCompanyPageContent(changes) {
  const { data } = await api.post(`${PAGE_URL}content/`, { changes })
  return data
}

export async function getEmployerPinnableJobs(q = '', { signal } = {}) {
  const { data } = await api.get(`${PAGE_URL}pinnable-jobs/`, { params: { q }, signal })
  return data.results || []
}

export async function getEmployerCompanyPageEditors({ signal } = {}) {
  const { data } = await api.get(`${PAGE_URL}editors/`, { signal })
  return data.results || []
}

export async function grantEmployerCompanyPageEditor(memberId) {
  const { data } = await api.post(`${PAGE_URL}editors/`, { member_id: memberId })
  return data
}

export async function revokeEmployerCompanyPageEditor(grantPublicId) {
  const { data } = await api.delete(`${PAGE_URL}editors/${encodeURIComponent(grantPublicId)}/`)
  return data
}
