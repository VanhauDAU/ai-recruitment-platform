// Deep-link chia sẻ lên mạng xã hội. Facebook/LinkedIn chỉ đọc `url` rồi tự lấy
// tiêu đề/ảnh từ thẻ OG phía server; `title` chỉ là gợi ý caption cho X/Telegram/email.
export function buildShareLinks({ url, title = '' }) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    twitter: `https://twitter.com/intent/tweet?url=${u}${title ? `&text=${t}` : ''}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    telegram: `https://t.me/share/url?url=${u}${title ? `&text=${t}` : ''}`,
    email: `mailto:?subject=${t}&body=${u}`,
  }
}

export function openShareWindow(href) {
  window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560')
}

/** Bảng chia sẻ của hệ điều hành (Zalo, Messenger, tin nhắn…) — chủ yếu có trên điện thoại. */
export function canUseWebShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** Trả về false khi trình duyệt không mở được bảng chia sẻ; người dùng tự đóng thì vẫn là true. */
export async function shareViaWebApi(data) {
  if (!canUseWebShare()) return false
  try {
    await navigator.share(data)
    return true
  } catch (error) {
    return error?.name === 'AbortError'
  }
}
