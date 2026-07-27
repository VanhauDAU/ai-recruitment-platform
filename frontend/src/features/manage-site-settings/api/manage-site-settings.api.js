import api from '@/shared/api/client'
import { invalidateRequestCache } from '@/shared/api/request-deduplication'

async function patchAdminSettings(payload) {
  const { data } = await api.patch('/site/admin/settings/', payload)
  invalidateRequestCache('site-settings')
  return data
}

export async function getAdminSettings() {
  const { data } = await api.get('/site/admin/settings/')
  return data
}

export async function updateAdminSettings(values, files = {}) {
  if (Object.keys(files).length) {
    const formData = new FormData()
    formData.append('values', JSON.stringify(values))
    Object.entries(files).forEach(([key, file]) => {
      formData.append(`files[${key}]`, file)
    })
    return patchAdminSettings(formData)
  }

  return patchAdminSettings({ values })
}
