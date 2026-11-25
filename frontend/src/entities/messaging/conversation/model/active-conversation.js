// Hội thoại đang mở trong tab này. Tin mới của nó không cần toast/chuông khi
// người dùng đang nhìn thấy; trạng thái thuần phía trình duyệt, không lưu.
let activeConversation = null

/** Register `publicId` as open; the returned function unregisters it. */
export function setActiveConversation(publicId) {
  activeConversation = publicId || null
  return () => {
    if (activeConversation === publicId) activeConversation = null
  }
}

export function isConversationInView(publicId) {
  return Boolean(publicId)
    && activeConversation === publicId
    && (typeof document === 'undefined' || document.visibilityState === 'visible')
}
