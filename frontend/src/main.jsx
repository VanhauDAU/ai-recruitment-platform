import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Build không có DSN thì nhánh này bị loại hẳn khỏi bundle khởi tạo.
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@/shared/lib/error-reporting').then(({ initErrorReporting }) => initErrorReporting())
}

// Deploy mới xóa chunk cũ: tab đang mở bấm sang route lazy sẽ lỗi tải module.
// Tải lại để lấy index.html mới; tối đa một lần mỗi phút để không lặp vô hạn.
window.addEventListener('vite:preloadError', (event) => {
  if (Date.now() - Number(sessionStorage.getItem('chunk-reload-at')) < 60_000) return
  sessionStorage.setItem('chunk-reload-at', String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
