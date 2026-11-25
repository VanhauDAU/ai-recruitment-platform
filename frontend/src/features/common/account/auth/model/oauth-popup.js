// Đăng nhập mạng xã hội trong cửa sổ popup (desktop). COOP mặc định của backend
// cắt `window.opener`, nên hai cửa sổ cùng origin nói chuyện qua BroadcastChannel:
// popup phát { type: 'result', nonce, code | error, next }, cửa sổ gốc có đúng
// nonce trả { type: 'ack', nonce } rồi tự đổi code lấy phiên.
export const OAUTH_POPUP_CHANNEL = 'procv-oauth'
export const OAUTH_POPUP_ACK_TIMEOUT_MS = 1500

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 640

// Mobile/màn hẹp: popup bị chặn hoặc mở thành tab mới khó quay lại — giữ chuyển trang.
export function canUseOAuthPopup() {
  return typeof BroadcastChannel === 'function'
    && Boolean(window.matchMedia?.('(pointer: fine) and (min-width: 768px)').matches)
}

export function createOAuthNonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Phải gọi đồng bộ trong onClick, nếu không trình duyệt chặn popup. Trả null khi bị chặn.
export function openOAuthPopup(url) {
  const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2))
  const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2))
  const popup = window.open(
    url,
    OAUTH_POPUP_CHANNEL,
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
  )
  popup?.focus?.()
  return popup
}

// Phía popup: gửi kết quả, resolve true nếu cửa sổ gốc xác nhận kịp thời gian chờ.
export function relayOAuthResult({ nonce, code, error, next }) {
  if (typeof BroadcastChannel !== 'function') return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(OAUTH_POPUP_CHANNEL)
    const finish = (acked) => {
      clearTimeout(timer)
      channel.close()
      resolve(acked)
    }
    const timer = setTimeout(() => finish(false), OAUTH_POPUP_ACK_TIMEOUT_MS)
    channel.onmessage = ({ data }) => {
      if (data?.type === 'ack' && data.nonce === nonce) finish(true)
    }
    channel.postMessage({ type: 'result', nonce, code, error, next })
  })
}
