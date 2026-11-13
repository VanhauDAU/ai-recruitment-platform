const CHANNEL_NAME = 'procv:job-list-ranking'

const TAB_SOURCE_ID = globalThis.crypto?.randomUUID?.()
  ?? `job-list-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function publishJobListRankingChanged({ sourceId = TAB_SOURCE_ID } = {}) {
  if (typeof window === 'undefined') return
  if (typeof BroadcastChannel !== 'function') return

  const detail = { at: Date.now(), sourceId }
  const channel = new BroadcastChannel(CHANNEL_NAME)
  try {
    channel.postMessage(detail)
  } finally {
    channel.close()
  }
}

export function subscribeJobListRankingChanged(callback, { sourceId = TAB_SOURCE_ID } = {}) {
  if (typeof window === 'undefined') return () => {}

  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null
  const onMessage = (event) => {
    if (event.data?.sourceId === sourceId) return
    callback(event.data)
  }

  channel?.addEventListener('message', onMessage)

  return () => {
    channel?.removeEventListener('message', onMessage)
    channel?.close()
  }
}
