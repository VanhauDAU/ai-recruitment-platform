// Báo lỗi JavaScript lên Sentry, chỉ khi build có VITE_SENTRY_DSN. Dùng @sentry/browser
// (không phải @sentry/react: bản react kéo react vào đồ thị chunk của SDK, rolldown
// chia lại chunk khởi tạo +1,2 KiB; lỗi render chưa bắt của React 19 vẫn tới
// window.onerror). SDK nằm trong chunk riêng, nạp lúc trình duyệt rảnh sau khi
// trang đã hiển thị: không làm nặng bundle khởi tạo (check:bundle-budget). Lỗi
// xảy ra trước lúc SDK nạp xong bị bỏ qua.

const FILTERED = '[Filtered]'

// Token đặt lại mật khẩu, mã OAuth, mã mời nằm ở query/hash: không gửi đi.
function stripUrlSecrets(url) {
  if (typeof url !== 'string') return url
  return url.replace(/[?#].*$/, '')
}

export function scrubEvent(event) {
  if (event.request) {
    event.request.url = stripUrlSecrets(event.request.url)
    delete event.request.cookies
    delete event.request.data
    if (event.request.query_string) event.request.query_string = FILTERED
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.data?.url) breadcrumb.data.url = stripUrlSecrets(breadcrumb.data.url)
    if (breadcrumb.data?.from) breadcrumb.data.from = stripUrlSecrets(breadcrumb.data.from)
    if (breadcrumb.data?.to) breadcrumb.data.to = stripUrlSecrets(breadcrumb.data.to)
  }
  return event
}

// Lỗi từ script mà trình duyệt trong app (Zalo, Facebook…) tự chèn vào trang, không
// phải mã của ProCV: gửi lên chỉ sinh email nhiễu.
export const IGNORED_ERRORS = [/zaloJSV2/]

// Lúc đang chờ mạng trình duyệt cũng "rảnh", nên đợi `load` rồi thêm vài giây để
// SDK không tranh băng thông với nội dung đầu trang.
const SDK_DELAY_MS = 4000

function whenIdle(callback) {
  const idle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 5000 })
    } else {
      callback()
    }
  }
  const later = () => window.setTimeout(idle, SDK_DELAY_MS)
  if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
}

export function initErrorReporting({
  dsn = import.meta.env.VITE_SENTRY_DSN,
  environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
  loadSdk = () => import('./sentry-sdk'),
  schedule = whenIdle,
} = {}) {
  if (!dsn) return false
  schedule(() => {
    loadSdk()
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment,
          sendDefaultPii: false,
          ignoreErrors: IGNORED_ERRORS,
          beforeSend: scrubEvent,
          beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
        })
      })
      .catch(() => {})
  })
  return true
}
