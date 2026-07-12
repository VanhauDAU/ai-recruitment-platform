import api from '@/shared/api/client'

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
    const { data } = await api.patch('/site/admin/settings/', formData)
    return data
  }

  const { data } = await api.patch('/site/admin/settings/', { values })
  return data
}
