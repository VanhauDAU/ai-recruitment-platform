import api from '@/shared/api/client'
import { dedupeRequest } from '@/shared/api/request-deduplication'
import { getAccessToken } from '../model/session.storage'

export async function getCurrentSessionUser() {
  const token = getAccessToken()
  return dedupeRequest(`session-me:${token || 'anonymous'}`, async () => {
    const { data } = await api.get('/auth/me/')
    return data
  })
}
