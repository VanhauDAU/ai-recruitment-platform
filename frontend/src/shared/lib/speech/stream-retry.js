/**
 * Chính sách chờ dùng chung cho mọi luồng đọc: engine tổng hợp chỉ có một số
 * worker cố định nên 429/503 là trạng thái xếp hàng bình thường, không phải lỗi.
 */
export const MAX_STREAM_ATTEMPTS = 3
export const MAX_QUEUE_WAIT_MS = 8_000

const RETRY_STATUSES = new Set([429, 503])
const DEFAULT_RETRY_MS = 1_000
const MAX_RETRY_MS = 4_000

export function now() {
  return window.performance?.now?.() ?? Date.now()
}

export function retryDelayMs(error) {
  const seconds = Number(error?.retryAfter || error?.response?.headers?.['retry-after']) || 0
  return Math.min(MAX_RETRY_MS, Math.max(seconds * 1000, DEFAULT_RETRY_MS))
}

export function retryableStatus(error) {
  return RETRY_STATUSES.has(error?.status ?? error?.response?.status)
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
