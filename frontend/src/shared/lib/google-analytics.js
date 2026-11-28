// Google Analytics 4 (gtag.js), chỉ gọi sau khi người xem đồng ý nhóm Hiệu năng.
// Không có script inline: hàm gtag dựng ở đây nên CSP chỉ cần cho phép
// https://www.googletagmanager.com trong script-src.
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,16}$/
const SCRIPT_ID = 'procv-gtag'

export const isMeasurementId = (id) => typeof id === 'string' && MEASUREMENT_ID.test(id)

/** Tải gtag.js một lần; gọi lại với cùng mã chỉ bật lại việc gửi. */
export function enableGoogleAnalytics(id) {
  if (!isMeasurementId(id)) return
  window[`ga-disable-${id}`] = false
  if (document.getElementById(SCRIPT_ID)) return
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag.js đọc đúng đối tượng arguments, không phải mảng.
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  // Lượt xem khi đổi route do "Đo lường nâng cao" của luồng GA4 bắt từ History API.
  window.gtag('config', id)
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}

/** Ngừng gửi (gtag đã tải vẫn nằm đó nhưng bỏ qua mọi hit). */
export function pauseGoogleAnalytics(id) {
  if (isMeasurementId(id)) window[`ga-disable-${id}`] = true
}

/** Xóa cookie _ga* khi người xem chưa hoặc rút đồng ý Hiệu năng. */
export function clearGoogleAnalyticsCookies() {
  const labels = window.location.hostname.split('.')
  // gtag đặt cookie ở domain cao nhất ghi được (vd .procv.site): thử mọi cấp.
  const domains = ['', ...labels.slice(0, -1).map((_, i) => `; domain=.${labels.slice(i).join('.')}`)]
  document.cookie.split(';').forEach((pair) => {
    const name = pair.split('=')[0].trim()
    if (!/^_ga(_|$)/.test(name)) return
    domains.forEach((domain) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    })
  })
}
