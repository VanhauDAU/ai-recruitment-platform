const CHANNEL_NAME = 'procv:saved-jobs'
const EVENT_NAME = 'procv:saved-jobs:changed'

export function publishSavedJobsChanged(payload) {
  if (typeof window === 'undefined') return

  const detail = { ...payload, at: Date.now() }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))

  if (typeof BroadcastChannel !== 'function') return
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(detail)
  channel.close()
}

export function subscribeSavedJobsSync(callback, { sourceId } = {}) {
  if (typeof window === 'undefined') return () => {}

  const notify = (detail) => {
    if (sourceId && detail?.sourceId === sourceId) return
    callback(detail)
  }
  const onLocalChange = (event) => notify(event.detail)
  const onFocus = () => callback()
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') callback()
  }
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null
  const onMessage = (event) => notify(event.data)

  channel?.addEventListener('message', onMessage)
  window.addEventListener(EVENT_NAME, onLocalChange)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    channel?.close()
    window.removeEventListener(EVENT_NAME, onLocalChange)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
