import {
  appendNewer,
  conversationKeys,
  getConversationMessages,
  lastSeq,
} from '@/entities/messaging/conversation'

const MAX_GAP_PAGES = 5
const inflight = new Map()

async function fill(queryClient, portal, conversationId) {
  const key = conversationKeys.messages(portal, conversationId)
  for (let round = 0; round < MAX_GAP_PAGES; round += 1) {
    const thread = queryClient.getQueryData(key)
    if (!thread) return
    const page = await getConversationMessages(portal, conversationId, { after: lastSeq(thread.messages) })
    queryClient.setQueryData(key, (current) => appendNewer(current, page))
    if (!page.has_more) return
  }
  // Quá xa: tải lại trang mới nhất (queryFn tự bỏ phần lịch sử bị hở).
  await queryClient.invalidateQueries({ queryKey: key })
}

/**
 * Fetch `after=<last seq>` until the cached thread is contiguous again. Calls
 * while a fill runs for the same thread schedule one more pass instead of a
 * parallel request.
 */
export function fillThreadGap(queryClient, portal, conversationId) {
  const id = `${portal}:${conversationId}`
  const running = inflight.get(id)
  if (running) {
    running.again = true
    return running.promise
  }
  const entry = { again: false, promise: null }
  entry.promise = (async () => {
    try {
      do {
        entry.again = false
        await fill(queryClient, portal, conversationId)
      } while (entry.again)
    } catch {
      // Lỗi mạng: lần `connected` hoặc lần mở hội thoại sau sẽ bù tiếp.
    } finally {
      inflight.delete(id)
    }
  })()
  inflight.set(id, entry)
  return entry.promise
}
