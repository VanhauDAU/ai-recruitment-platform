// Luồng tin trong cache: `{ messages, hasMore }`. Tin của server có `seq`; tin
// đang gửi/lỗi phía trình duyệt chưa có `seq`, nhận diện bằng `client_id` và
// nằm cuối luồng tới khi server trả bản chính thức (cùng `client_id`).

export function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Trình duyệt cũ/không phải secure context: UUID v4 từ Math.random là đủ cho idempotency.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random % 4) + 8).toString(16)
  })
}

export const isPendingMessage = (message) => !message?.seq

export function lastSeq(messages = []) {
  return messages.reduce((max, message) => (message.seq > max ? message.seq : max), 0)
}

export function firstSeq(messages = []) {
  return messages.reduce((min, message) => (message.seq && (!min || message.seq < min) ? message.seq : min), 0)
}

/** Union by `seq` (later copy wins), dropping optimistic entries the server has confirmed. */
export function mergeMessages(current = [], incoming = []) {
  const bySeq = new Map()
  const pending = new Map()
  for (const message of [...current, ...incoming]) {
    if (message.seq) bySeq.set(message.seq, message)
    else pending.set(message.client_id, message)
  }
  const confirmed = [...bySeq.values()].sort((a, b) => a.seq - b.seq)
  const confirmedIds = new Set(confirmed.map((message) => message.client_id).filter(Boolean))
  return [...confirmed, ...[...pending.values()].filter((message) => !confirmedIds.has(message.client_id))]
}

/**
 * A pushed message joins the thread only when it follows the last known `seq`;
 * otherwise `gap` asks the caller to fetch `after=<last seq>` first.
 */
export function applyIncomingMessage(thread, message) {
  if (!thread || !message?.seq) return { thread, gap: false }
  const last = lastSeq(thread.messages)
  if (last && message.seq > last + 1) return { thread, gap: true }
  return { thread: { ...thread, messages: mergeMessages(thread.messages, [message]) }, gap: false }
}

/** An edited card (interview status…) replaces its copy; unknown messages are ignored. */
export function replaceMessage(thread, message) {
  if (!thread || !thread.messages.some((item) => item.seq === message.seq || (item.public_id && item.public_id === message.public_id))) {
    return thread
  }
  return { ...thread, messages: mergeMessages(thread.messages, [message]) }
}

/** The newest page from the server against what the cache already holds. */
export function reconcileLatest(previous, page) {
  const fresh = page?.results || []
  if (!previous?.messages?.length) return { messages: mergeMessages([], fresh), hasMore: Boolean(page?.has_more) }
  const known = lastSeq(previous.messages)
  if (!fresh.length || (known && firstSeq(fresh) <= known + 1)) {
    return {
      messages: mergeMessages(previous.messages, fresh),
      hasMore: known ? previous.hasMore : Boolean(page?.has_more),
    }
  }
  // Hole between the cache and the newest page: keep only what is still sending.
  return { messages: mergeMessages(previous.messages.filter(isPendingMessage), fresh), hasMore: Boolean(page?.has_more) }
}

export function prependOlder(thread, page) {
  return { messages: mergeMessages(thread?.messages, page?.results || []), hasMore: Boolean(page?.has_more) }
}

export function appendNewer(thread, page) {
  return { messages: mergeMessages(thread?.messages, page?.results || []), hasMore: thread?.hasMore ?? false }
}

export function patchPendingMessage(thread, clientId, patch) {
  if (!thread) return thread
  return {
    ...thread,
    messages: thread.messages.map((message) => (
      isPendingMessage(message) && message.client_id === clientId ? { ...message, ...patch } : message
    )),
  }
}

/** Browser-side copy shown while sending; `payload` is what a retry sends again. */
export function optimisticMessage({ clientId, payload, preview = {}, senderRole = '' }) {
  return {
    public_id: null,
    seq: null,
    client_id: clientId,
    kind: payload.file ? (payload.file.type?.startsWith('image/') ? 'image' : 'file') : payload.kind,
    sender_role: senderRole,
    mine: true,
    body: payload.body || '',
    created_at: new Date().toISOString(),
    job: preview.job || null,
    cv: preview.cv || null,
    file: payload.file ? { name: payload.file.name, content_type: payload.file.type, size: payload.file.size } : null,
    interview: null,
    system: null,
    status: 'sending',
    payload,
  }
}

/** `seq` of my newest delivered message once the other side has read it, else null. */
export function seenMessageSeq(messages = [], peerLastReadSeq = 0) {
  const mine = [...messages].reverse().find((message) => message.mine && message.seq)
  return mine && peerLastReadSeq >= mine.seq ? mine.seq : null
}

/** Highest `seq` the other side sent; reading up to it clears the unread badge. */
export function lastPeerSeq(messages = []) {
  return messages.reduce((max, message) => (!message.mine && message.seq > max ? message.seq : max), 0)
}
