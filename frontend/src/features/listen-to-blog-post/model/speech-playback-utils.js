export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5]

const VOICE_STORAGE_KEY = 'procv_blog_speech_voice_v1'
const STYLE_STORAGE_KEY = 'procv_blog_speech_style_v1'
const RATE_STORAGE_KEY = 'procv_blog_speech_rate_v1'

export function normalizeDefaultAsset(asset) {
  if (asset?.status !== 'ready' || !asset?.url) return null
  return {
    style: asset.style || 'tu_nhien',
    url: asset.url,
    voiceId: asset.voice_id || '',
  }
}

export function findPreparedAsset(defaultAsset, preparedAssets, voiceId, style) {
  // Empty preferences mean "use the server default". Never pick an arbitrary
  // custom variant merely because it is the first persisted asset in the list.
  if (!voiceId && !style) return normalizeDefaultAsset(defaultAsset)
  const candidates = [defaultAsset, ...(Array.isArray(preparedAssets) ? preparedAssets : [])]
  const seen = new Set()
  for (const candidate of candidates) {
    const asset = normalizeDefaultAsset(candidate)
    if (!asset) continue
    const identity = `${asset.voiceId}\0${asset.style}\0${asset.url}`
    if (seen.has(identity)) continue
    seen.add(identity)
    if (assetMatches(asset, voiceId, style)) return asset
  }
  return null
}

export function assetMatches(asset, voiceId, style) {
  if (!asset) return false
  if (voiceId && (!asset.voiceId || voiceId !== asset.voiceId)) return false
  if (style && style !== asset.style) return false
  return true
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

export function storedSpeechVoice() {
  return storedValue(VOICE_STORAGE_KEY)
}

export function storedSpeechStyle() {
  return storedValue(STYLE_STORAGE_KEY)
}

export function storedSpeechRate() {
  const value = Number(storedValue(RATE_STORAGE_KEY))
  return PLAYBACK_RATES.includes(value) ? value : 1
}

export function storeSpeechPreferences({ rate, style, voiceId }) {
  storeValue(VOICE_STORAGE_KEY, voiceId)
  storeValue(STYLE_STORAGE_KEY, style)
  storeValue(RATE_STORAGE_KEY, rate)
}

export function storeSpeechRate(rate) {
  storeValue(RATE_STORAGE_KEY, rate)
}
