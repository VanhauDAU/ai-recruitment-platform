import axios from 'axios'
import { getAuthStorageKeys } from '../config/portals'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const { access } = getAuthStorageKeys()
  const token = localStorage.getItem(access)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const { access, refresh } = getAuthStorageKeys()
      const refreshToken = localStorage.getItem(refresh)
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh: refreshToken })
          localStorage.setItem(access, data.access)
          if (data.refresh) localStorage.setItem(refresh, data.refresh)
          originalRequest.headers.Authorization = `Bearer ${data.access}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem(access)
          localStorage.removeItem(refresh)
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
