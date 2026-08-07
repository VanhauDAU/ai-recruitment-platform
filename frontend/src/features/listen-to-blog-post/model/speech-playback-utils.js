export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5]

const RATE_STORAGE_KEY = 'procv_blog_speech_rate_v1'

export function normalizeDefaultAsset(asset) {
  if (asset?.status !== 'ready' || !asset?.url) return null
  return {
    style: asset.style || 'tu_nhien',
    url: asset.url,
    voiceId: asset.voice_id || '',
  }
}

export function findPreparedAsset(defaultAsset) {
  return normalizeDefaultAsset(defaultAsset)
}

export function connectionAllowsPreload() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!connection) return true
  if (connection.saveData) return false
  return !['slow-2g', '2g'].includes(connection.effectiveType)
}

function storedValue(key) {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Storage denial must never break playback.
  }
}

export function storedSpeechRate() {
  const value = Number(storedValue(RATE_STORAGE_KEY))
  return PLAYBACK_RATES.includes(value) ? value : 1
}

export function storeSpeechRate(rate) {
  storeValue(RATE_STORAGE_KEY, rate)
}
