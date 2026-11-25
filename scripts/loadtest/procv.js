// Kịch bản tải ProCV cho k6 (https://k6.io). Hướng dẫn: scripts/loadtest/README.md.
//
//   k6 run -e BASE_URL=https://staging.procv.site scripts/loadtest/procv.js
//
// Ba nhóm người dùng chạy song song (mặc định 200 VU tổng): khách vãng lai 80 %,
// ứng viên đã đăng nhập 15 %, nhà tuyển dụng 5 %. Ngưỡng đạt: p95 < 800 ms,
// lỗi < 1 %.

import http from 'k6/http'
import ws from 'k6/ws'
import { check, fail, group, sleep } from 'k6'

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
const API = `${BASE_URL}/api`
const WS_URL = BASE_URL.replace(/^http/, 'ws')
const VUS = Number(__ENV.VUS || 200)
const HOLD = __ENV.DURATION || '10m'
const RAMP = __ENV.RAMP || '2m'
// Token bất kỳ: môi trường kiểm thử dùng secret thử của reCAPTCHA (luôn hợp lệ).
const CAPTCHA_TOKEN = __ENV.CAPTCHA_TOKEN || 'loadtest'
const ACCOUNTS = {
  main: { email: __ENV.CANDIDATE_EMAIL, password: __ENV.CANDIDATE_PASSWORD },
  employer: { email: __ENV.EMPLOYER_EMAIL, password: __ENV.EMPLOYER_PASSWORD },
}
const SEARCH_TERMS = ['ke toan', 'nhan vien kinh doanh', 'lap trinh', 'marketing', 'ban hang']
const SUGGEST_PREFIXES = ['ke', 'nha', 'lap', 'mar', 'ky']
// Hà Nội, TP.HCM, Đà Nẵng.
const POINTS = [
  [21.028, 105.854],
  [10.776, 106.7],
  [16.054, 108.202],
]
// Rehearsal để site sau Cloudflare Access: dùng service token để k6 đi qua.
const ACCESS_HEADERS = __ENV.CF_ACCESS_CLIENT_ID
  ? {
      'CF-Access-Client-Id': __ENV.CF_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': __ENV.CF_ACCESS_CLIENT_SECRET || '',
    }
  : {}
const JSON_HEADERS = { 'Content-Type': 'application/json' }

function stages(share) {
  const target = Math.max(1, Math.round(VUS * share))
  return [
    { duration: RAMP, target },
    { duration: HOLD, target },
    { duration: '1m', target: 0 },
  ]
}

export const options = {
  scenarios: {
    visitors: { executor: 'ramping-vus', exec: 'visitor', stages: stages(0.8) },
    candidates: { executor: 'ramping-vus', exec: 'candidate', stages: stages(0.15) },
    employers: { executor: 'ramping-vus', exec: 'employer', stages: stages(0.05) },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
    // Từng luồng chính, để biết luồng nào kéo p95 lên.
    'http_req_duration{flow:home}': ['p(95)<800'],
    'http_req_duration{flow:search}': ['p(95)<800'],
    'http_req_duration{flow:detail}': ['p(95)<800'],
    'http_req_duration{flow:suggest}': ['p(95)<800'],
    'http_req_duration{flow:nearby}': ['p(95)<800'],
    'http_req_duration{flow:candidate}': ['p(95)<800'],
    'http_req_duration{flow:employer}': ['p(95)<800'],
  },
}

const pick = (items) => items[Math.floor(Math.random() * items.length)]
const think = () => sleep(1 + Math.random() * 3)

function get(url, flow, params = {}) {
  const response = http.get(url, {
    ...params,
    headers: { ...ACCESS_HEADERS, ...(params.headers || {}) },
    tags: { flow, ...(params.tags || {}) },
  })
  check(response, { [`${flow} 2xx`]: (r) => r.status >= 200 && r.status < 300 })
  return response
}

function post(url, body, flow, params = {}) {
  const response = http.post(url, JSON.stringify(body), {
    ...params,
    headers: { ...ACCESS_HEADERS, ...JSON_HEADERS, ...(params.headers || {}) },
    tags: { flow, ...(params.tags || {}) },
  })
  check(response, { [`${flow} 2xx`]: (r) => r.status >= 200 && r.status < 300 })
  return response
}

export function setup() {
  const response = http.get(`${API}/public/jobs/?page_size=60`, { headers: ACCESS_HEADERS })
  if (response.status !== 200) fail(`Không đọc được danh sách việc làm: ${response.status}`)
  const slugs = response.json('results').map((job) => job.slug)
  if (!slugs.length) fail('Môi trường chưa có tin công khai — seed dữ liệu trước khi đo.')
  return { slugs }
}

// ── Khách vãng lai ──────────────────────────────────────────────────────────

function home() {
  group('home', () => {
    get(`${BASE_URL}/`, 'home')
    get(`${API}/public/jobs/stats/`, 'home')
    get(`${API}/public/jobs/best/?page_size=12&rotation_seed=k6-${__VU}`, 'home')
    get(`${API}/public/jobs/best/locations/`, 'home')
    get(`${API}/public/companies/`, 'home')
    get(`${API}/public/jobs/categories/?all=1`, 'home')
  })
}

function search() {
  group('search', () => {
    get(`${API}/public/jobs/?page=1`, 'search')
    const term = encodeURIComponent(pick(SEARCH_TERMS))
    get(`${API}/public/jobs/?search=${term}&search_by=both`, 'search')
    get(`${API}/public/jobs/?salary_bucket=15-20&ordering=newest`, 'search')
  })
}

function suggest() {
  group('suggest', () => {
    const prefix = pick(SUGGEST_PREFIXES)
    // Gõ từng ký tự như ô tìm kiếm (client đã debounce).
    for (let length = 2; length <= prefix.length; length += 1) {
      get(`${API}/public/jobs/suggest/?q=${prefix.slice(0, length)}`, 'suggest')
    }
  })
}

function detail(slugs) {
  group('detail', () => {
    const slug = pick(slugs)
    // HTML có metadata SEO (route Django sau nginx) rồi API chi tiết như SPA gọi.
    get(`${BASE_URL}/viec-lam/${slug}`, 'detail')
    get(`${API}/public/jobs/${slug}/`, 'detail')
  })
}

function impressions(slugs) {
  group('impression', () => {
    const batch = Array.from({ length: 12 }, () => pick(slugs))
    post(`${API}/public/jobs/impressions/`, { slugs: [...new Set(batch)] }, 'impression')
  })
}

function nearby() {
  group('nearby', () => {
    const [lat, lng] = pick(POINTS)
    get(`${API}/public/jobs/nearby/?lat=${lat}&lng=${lng}&radius_km=10`, 'nearby')
    get(`${API}/public/jobs/nearby/map/?lat=${lat}&lng=${lng}&radius_km=10`, 'nearby')
  })
}

let consentGiven = false

export function visitor(data) {
  if (!consentGiven) {
    // Cookie đồng ý Analytics: impression đi đúng đường ghi thật.
    post(
      `${API}/public/privacy/consent/`,
      { preferences: false, analytics: true, marketing: false },
      'consent',
    )
    consentGiven = true
  }
  const roll = Math.random()
  if (roll < 0.3) home()
  else if (roll < 0.55) search()
  else if (roll < 0.65) suggest()
  else if (roll < 0.9) detail(data.slugs)
  else nearby()
  impressions(data.slugs)
  think()
}

// ── Người dùng đã đăng nhập ─────────────────────────────────────────────────

const session = { access: '', issuedAt: 0 }

function authHeaders() {
  return { headers: { Authorization: `Bearer ${session.access}` } }
}

function signIn(portal) {
  const account = ACCOUNTS[portal]
  if (!account.email || !account.password) {
    fail(`Thiếu ${portal === 'main' ? 'CANDIDATE' : 'EMPLOYER'}_EMAIL/_PASSWORD`)
  }
  const now = Date.now()
  if (!session.access) {
    const response = post(
      `${API}/auth/login/`,
      { ...account, portal, captcha_token: CAPTCHA_TOKEN },
      'auth',
    )
    session.access = response.json('access') || ''
    session.issuedAt = now
  } else if (now - session.issuedAt > 10 * 60 * 1000) {
    // Access token sống 15 phút; refresh cookie nằm trong cookie jar của VU.
    const response = post(`${API}/auth/refresh/`, { portal }, 'auth')
    session.access = response.json('access') || session.access
    session.issuedAt = now
  }
}

function realtime() {
  group('websocket', () => {
    const ticket = post(`${API}/shared/realtime/ticket/`, {}, 'websocket', authHeaders())
    const value = ticket.json('ticket')
    if (!value) return
    const response = ws.connect(
      `${WS_URL}/ws/notifications/?ticket=${value}`,
      // SameOriginWebsocketGuard từ chối handshake không có Origin của site.
      { headers: { ...ACCESS_HEADERS, Origin: BASE_URL }, tags: { flow: 'websocket' } },
      (socket) => {
        // Giữ kết nối như một tab đang mở, rồi đóng.
        socket.setTimeout(() => socket.close(), 15000 + Math.random() * 15000)
      },
    )
    check(response, { 'websocket 101': (r) => r && r.status === 101 })
  })
}

export function candidate(data) {
  signIn('main')
  group('candidate', () => {
    get(`${API}/auth/me/`, 'candidate', authHeaders())
    get(`${API}/candidate/jobs/recommendations/for-me/`, 'candidate', authHeaders())
  })
  if (Math.random() < 0.5) search()
  else detail(data.slugs)
  if (__ITER % 10 === 0) realtime()
  think()
}

export function employer() {
  signIn('employer')
  group('employer', () => {
    get(`${API}/auth/me/`, 'employer', authHeaders())
    get(`${API}/employer/applications/?page=1`, 'employer', authHeaders())
    get(`${API}/employer/jobs/?page=1`, 'employer', authHeaders())
  })
  if (__ITER % 10 === 0) realtime()
  think()
}
