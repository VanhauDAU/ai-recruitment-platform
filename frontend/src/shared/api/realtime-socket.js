// Một WebSocket thông báo cho cả tab, dùng chung giữa mọi subscriber. Hạ tầng
// thuần: không biết loại sự kiện nghiệp vụ. Xác thực bằng vé một lần lấy qua
// REST (client gắn Bearer + tự refresh), không bao giờ đặt JWT lên URL.
//
// Sự kiện chỉ là tín hiệu để refetch; dữ liệu và quyền vẫn do REST quyết định.
// Mỗi lần kết nối (lại) phát `{ type: 'connected' }` để subscriber bù sự kiện
// có thể đã lỡ khi mất mạng.
import client from './client'

const TICKET_PATH = '/shared/realtime/ticket/'
const SOCKET_PATH = '/ws/notifications/'
const HEARTBEAT_MS = 25_000
// Không nhận gì (kể cả pong) trong ngần này là kết nối đã chết dù chưa đóng.
const STALE_MS = 60_000
const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000
// Server đóng 4401 khi vé/phiên hết hiệu lực: lấy vé mới, không dùng lại.
const CLOSE_UNAUTHORIZED = 4401

const listeners = new Set()
const statusListeners = new Set()
let status = 'idle'
let socket = null
let attempt = 0
let retryTimer = 0
let heartbeatTimer = 0
let lastMessageAt = 0
let connecting = false

export function socketUrl(baseURL = client.defaults.baseURL, location = window.location) {
  const api = new URL(baseURL, location.href)
  const protocol = api.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${api.host}${SOCKET_PATH}`
}

export function retryDelay(failures, random = Math.random) {
  const ceiling = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1))
  // Full jitter: các tab/người dùng không nối lại cùng một nhịp sau sự cố server.
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

function setStatus(next) {
  if (status === next) return
  status = next
  statusListeners.forEach((listener) => listener(next))
}

function emit(event) {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // Một subscriber lỗi không được làm mất sự kiện của subscriber khác.
    }
  })
}

function clearTimers() {
  window.clearTimeout(retryTimer)
  window.clearInterval(heartbeatTimer)
  retryTimer = 0
  heartbeatTimer = 0
}

function closeSocket() {
  const current = socket
  socket = null
  if (current) {
    current.onopen = null
    current.onmessage = null
    current.onclose = null
    current.onerror = null
    if (current.readyState <= 1) current.close(1000)
  }
}

function scheduleReconnect() {
  window.clearTimeout(retryTimer)
  if (!listeners.size) {
    setStatus('idle')
    return
  }
  setStatus('reconnecting')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return // chờ sự kiện `online`
  attempt += 1
  retryTimer = window.setTimeout(connect, retryDelay(attempt))
}

function startHeartbeat() {
  window.clearInterval(heartbeatTimer)
  heartbeatTimer = window.setInterval(() => {
    if (!socket || socket.readyState !== 1) return
    if (Date.now() - lastMessageAt > STALE_MS) {
      closeSocket()
      scheduleReconnect()
      return
    }
    socket.send('{"type":"ping"}')
  }, HEARTBEAT_MS)
}

function handleMessage({ data }) {
  lastMessageAt = Date.now()
  let event
  try {
    event = JSON.parse(data)
  } catch {
    return
  }
  if (!event || typeof event.type !== 'string' || event.type === 'pong') return
  if (event.type === 'ready') {
    attempt = 0
    setStatus('open')
    emit({ type: 'connected' })
    return
  }
  emit(event)
}

async function connect() {
  // Không cần access token sẵn trong memory: request vé tự refresh từ cookie.
  if (connecting || socket || !listeners.size) return
  connecting = true
  setStatus('connecting')
  let ticket
  try {
    ;({ data: { ticket } } = await client.post(TICKET_PATH))
  } catch (error) {
    connecting = false
    // 401 sau khi đã thử refresh: phiên hết, client đã xử lý đăng xuất.
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      setStatus('idle')
      return
    }
    scheduleReconnect()
    return
  }
  connecting = false
  if (!listeners.size) {
    setStatus('idle')
    return
  }
  const next = new WebSocket(`${socketUrl()}?ticket=${encodeURIComponent(ticket)}`)
  socket = next
  lastMessageAt = Date.now()
  next.onmessage = handleMessage
  next.onopen = startHeartbeat
  next.onclose = (event) => {
    if (socket !== next) return
    socket = null
    clearTimers()
    // Vé bị từ chối ngay lần đầu thì nối lại liền một lần với vé mới.
    if (event.code === CLOSE_UNAUTHORIZED && attempt === 0) {
      attempt = 1
      connect()
      return
    }
    scheduleReconnect()
  }
}

function reconnectNow() {
  if (!listeners.size || socket || connecting) return
  window.clearTimeout(retryTimer)
  connect()
}

function handleVisibility() {
  if (document.visibilityState === 'visible') reconnectNow()
}

function start() {
  window.addEventListener('online', reconnectNow)
  document.addEventListener('visibilitychange', handleVisibility)
  attempt = 0
  connect()
}

function stop() {
  window.removeEventListener('online', reconnectNow)
  document.removeEventListener('visibilitychange', handleVisibility)
  clearTimers()
  closeSocket()
  setStatus('idle')
}

/**
 * Nhận sự kiện realtime; socket mở khi có subscriber đầu tiên, đóng khi hết.
 * Subscriber là UI chỉ mount khi đã đăng nhập, nên đăng xuất cũng đóng socket.
 */
export function subscribeRealtime(listener) {
  listeners.add(listener)
  if (listeners.size === 1) start()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) stop()
  }
}

export function getRealtimeStatus() {
  return status
}

export function subscribeRealtimeStatus(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}
