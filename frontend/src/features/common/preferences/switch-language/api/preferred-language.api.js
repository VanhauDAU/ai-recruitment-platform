import api from '@/shared/api/client'

export async function savePreferredLanguage(preferredLanguage) {
  const { data } = await api.patch('/auth/me/', { preferred_language: preferredLanguage })
  return data
}
