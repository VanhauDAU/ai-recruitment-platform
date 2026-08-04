export const DEFAULT_SAMPLE_RATE = 48_000

export function audioContextConstructor() {
  return window.AudioContext || window.webkitAudioContext
}

function connectionType() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return connection?.effectiveType || 'unknown'
}

/**
 * Cache hit chỉ cần một đệm rất ngắn vì dữ liệu về đều. Luồng inference cần
 * nhiều hơn và tự tăng theo tốc độ đọc/chất lượng mạng để tránh đánh đổi độ
 * trễ khởi động lấy tiếng bị ngắt quãng.
 */
export function initialBufferSeconds({ cached, rate }) {
  const network = connectionType()
  const networkFactor = network === '3g' ? 1.25 : ['slow-2g', '2g'].includes(network) ? 1.7 : 1
  const rateFactor = Math.max(1, Math.min(Number(rate) || 1, 1.5))
  const target = (cached ? 0.2 : 0.48) * networkFactor * rateFactor
  const ceiling = ['slow-2g', '2g'].includes(network) ? 1 : cached ? 0.35 : 0.65
  return Math.min(ceiling, Math.max(cached ? 0.18 : 0.45, target))
}

export function mergeBytes(left, right) {
  if (!left.byteLength) return right
  const merged = new Uint8Array(left.byteLength + right.byteLength)
  merged.set(left)
  merged.set(right, left.byteLength)
  return merged
}

export function pcm16ToFloat32(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const samples = new Float32Array(bytes.byteLength / 2)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768
  }
  return samples
}

/**
 * Đọc sample rate và vị trí chunk `data` thật từ header WAV. Không thể giả định
 * header dài đúng 44 byte: file WAV hợp lệ được phép chèn thêm chunk (LIST,
 * fact...) trước `data`, và bỏ nhầm vài byte sẽ lệch khung PCM16 -> nhiễu trắng.
 */
export function parseWavHeader(bytes) {
  if (bytes.byteLength < 12) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (offset) => String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
  if (ascii(0) !== 'RIFF' || ascii(8) !== 'WAVE') return null

  let offset = 12
  let sampleRate = DEFAULT_SAMPLE_RATE
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(offset)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ' && offset + 8 + 16 <= bytes.byteLength) {
      sampleRate = view.getUint32(offset + 12, true) || DEFAULT_SAMPLE_RATE
    }
    if (id === 'data') return { dataOffset: offset + 8, sampleRate }
    if (size === 0xFFFFFFFF) return null
    offset += 8 + size + (size % 2)
  }
  return null
}

export async function responseError(response) {
  const retryAfter = Number(response.headers.get('Retry-After')) || 0
  let detail = ''
  try {
    detail = (await response.json())?.detail || ''
  } catch {
    detail = ''
  }
  const error = new Error(detail || `Không thể mở luồng âm thanh (${response.status}).`)
  error.status = response.status
  error.retryAfter = retryAfter
  return error
}
