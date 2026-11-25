// Danh sách hội thoại là cache infinite `{ pages: [{ results, next… }], pageParams }`.

function locate(data, publicId) {
  for (const [pageIndex, page] of (data?.pages || []).entries()) {
    const index = page.results?.findIndex((item) => item.public_id === publicId) ?? -1
    if (index >= 0) return { pageIndex, index, conversation: page.results[index] }
  }
  return null
}

export function findCachedConversation(data, publicId) {
  return locate(data, publicId)?.conversation || null
}

/**
 * A new message moves its conversation to the top with a fresh preview. Returns
 * `null` when the conversation is not cached, so the caller refetches the list.
 */
export function applyMessageToList(data, publicId, message, { unreadCount, open = false } = {}) {
  const found = locate(data, publicId)
  if (!found) return null
  const { conversation } = found
  const unread = open || message.mine
    ? 0
    : (unreadCount ?? (conversation.unread_count || 0) + 1)
  const updated = {
    ...conversation,
    last_message: {
      preview: message.kind === 'text' ? message.body : '',
      kind: message.kind,
      sender_role: message.sender_role,
      created_at: message.created_at,
    },
    last_message_at: message.created_at,
    last_seq: Math.max(conversation.last_seq || 0, message.seq || 0),
    unread_count: unread,
  }
  const pages = data.pages.map((page, pageIndex) => (
    pageIndex === found.pageIndex
      ? { ...page, results: page.results.filter((item) => item.public_id !== publicId) }
      : page
  ))
  pages[0] = { ...pages[0], results: [updated, ...pages[0].results] }
  return { ...data, pages }
}

export function markListConversationRead(data, publicId) {
  const found = locate(data, publicId)
  if (!found || !found.conversation.unread_count) return data
  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => (
      pageIndex === found.pageIndex
        ? { ...page, results: page.results.map((item) => (item.public_id === publicId ? { ...item, unread_count: 0 } : item)) }
        : page
    )),
  }
}
