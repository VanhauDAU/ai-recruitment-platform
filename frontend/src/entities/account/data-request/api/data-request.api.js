import api from '@/shared/api/client'

// Yêu cầu của chủ thể dữ liệu (Nghị định 13/2023): người dùng gửi ở /shared,
// quản trị viên xử lý ở /admin.
export const dataRequestKeys = {
  mine: ['privacy-requests', 'mine'],
  adminLists: ['privacy-requests', 'admin'],
  adminList: (params) => ['privacy-requests', 'admin', params],
}

export async function listMyDataRequests() {
  const { data } = await api.get('/shared/privacy/requests/')
  return data
}

export async function submitDataRequest({ kind, note = '' }) {
  const { data } = await api.post('/shared/privacy/requests/', { kind, note })
  return data
}

export async function cancelDataRequest(publicId) {
  const { data } = await api.post(`/shared/privacy/requests/${publicId}/cancel/`)
  return data
}

export async function fetchDataExport(publicId) {
  const { data } = await api.get(`/shared/privacy/requests/${publicId}/export/`, {
    responseType: 'blob',
  })
  return data
}

export async function getAdminDataRequests(params = {}, config = {}) {
  const { data } = await api.get('/admin/privacy/requests/', { ...config, params })
  return data
}

export async function completeAdminDataRequest(publicId, note = '') {
  const { data } = await api.post(`/admin/privacy/requests/${publicId}/complete/`, { note })
  return data
}

export async function rejectAdminDataRequest(publicId, note) {
  const { data } = await api.post(`/admin/privacy/requests/${publicId}/reject/`, { note })
  return data
}
