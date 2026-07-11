import api from './api'
import { dedupeRequest } from './requestDeduplication'

export async function getLinkGroups(placement) {
  return dedupeRequest(`link-groups:${placement || 'all'}`, async () => {
    const { data } = await api.get('/site/link-groups/', { params: placement ? { placement } : {} })
    return data
  })
}

export async function getSiteSettings() {
  return dedupeRequest('site-settings', async () => {
    const { data } = await api.get('/site/settings/')
    return data
  })
}

export async function getBanners(placement) {
  return dedupeRequest(`banners:${placement || 'all'}`, async () => {
    const { data } = await api.get('/site/banners/', { params: placement ? { placement } : {} })
    return data
  })
}

// Góp ý / báo lỗi từ nút nổi "Hỗ trợ". Khách chưa đăng nhập vẫn gửi được.
export async function submitFeedback(payload) {
  const { data } = await api.post('/site/feedback/', payload)
  return data
}
