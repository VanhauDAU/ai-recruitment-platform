import api from '@/shared/api/client'
import { cachedRequest } from '@/shared/api/request-deduplication'

const SITE_CACHE_TTL = 5 * 60 * 1000

export async function getLinkGroups(placement) {
  return cachedRequest(`link-groups:${placement || 'all'}`, SITE_CACHE_TTL, async () => {
    const { data } = await api.get('/public/site/link-groups/', { params: placement ? { placement } : {} })
    return data
  })
}

export async function getSiteSettings() {
  return cachedRequest('site-settings', SITE_CACHE_TTL, async () => {
    const { data } = await api.get('/public/site/settings/')
    return data
  })
}
