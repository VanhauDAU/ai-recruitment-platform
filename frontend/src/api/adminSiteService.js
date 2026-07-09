import api from './api'

export async function getAdminSettings() {
  const { data } = await api.get('/site/admin/settings/')
  return data
}

export async function updateAdminSettings(values) {
  const { data } = await api.patch('/site/admin/settings/', { values })
  return data
}

export async function uploadSettingImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/site/admin/settings/upload/', formData)
  return data
}
