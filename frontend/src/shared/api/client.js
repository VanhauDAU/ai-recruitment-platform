// Axios instance dùng chung + interceptor auth/refresh. Đây là hạ tầng HTTP:
// KHÔNG biết endpoint nghiệp vụ (domain service tự khai path). Xem ADR 0002.
import axios from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStore'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const client = axios.create({ baseURL })

// Gắn access token của portal hiện tại vào mỗi request.
client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 -> thử refresh một lần rồi phát lại request gốc; thất bại thì xóa phiên.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          // Dùng axios trần (không qua instance) để không lặp interceptor.
          const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh: refreshToken })
          setTokens({ access: data.access, refresh: data.refresh })
          originalRequest.headers.Authorization = `Bearer ${data.access}`
          return client(originalRequest)
        } catch {
          clearTokens()
        }
      }
    }
    return Promise.reject(error)
  },
)

export default client
