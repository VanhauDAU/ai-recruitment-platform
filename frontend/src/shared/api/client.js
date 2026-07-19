// Axios instance dùng chung + interceptor auth/refresh. Đây là hạ tầng HTTP:
// KHÔNG biết endpoint nghiệp vụ (domain service tự khai path). Xem ADR 0002.
import axios from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-store'

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

// Single-flight: nhiều request 401 đồng thời chỉ gọi /auth/refresh MỘT lần. Vì
// backend rotation + blacklist token cũ, nếu để mỗi request tự refresh thì request
// thứ hai dùng lại refresh đã bị blacklist -> 401 -> văng phiên oan.
let refreshPromise = null

function refreshAccessToken(refreshToken) {
  if (!refreshPromise) {
    // Dùng axios trần (không qua instance) để không lặp interceptor.
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh/`, { refresh: refreshToken })
      .then(({ data }) => {
        setTokens({ access: data.access, refresh: data.refresh })
        return data.access
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

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
          const access = await refreshAccessToken(refreshToken)
          originalRequest.headers.Authorization = `Bearer ${access}`
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
