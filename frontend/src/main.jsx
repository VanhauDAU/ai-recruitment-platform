import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Build không có DSN thì nhánh này bị loại hẳn khỏi bundle khởi tạo.
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@/shared/lib/error-reporting').then(({ initErrorReporting }) => initErrorReporting())
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
