import api from '@/shared/api/client'
import { cachedRequest } from '@/shared/api/request-deduplication'

export function getLocales() {
  return cachedRequest('site-locales', 5 * 60 * 1000, async () => {
    const { data } = await api.get('/site/locales/')
    return data
  })
}

export async function getAdminLocales() {
  const { data } = await api.get('/site/admin/locales/')
  return data
}
