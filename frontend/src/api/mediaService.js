import api from './api'

function imageFormData(file) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export async function uploadAvatar(file) {
  const { data } = await api.post('/auth/avatar/', imageFormData(file))
  return data
}

export async function uploadEmployerLogo(file) {
  const { data } = await api.post('/employer/profile/logo/', imageFormData(file))
  return data
}

export async function uploadEmployerCover(file) {
  const { data } = await api.post('/employer/profile/cover/', imageFormData(file))
  return data
}
