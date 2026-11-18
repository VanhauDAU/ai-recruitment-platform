export const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`

export function postText(content = {}) {
  const tags = (content.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
  return [content.headline, content.body, content.call_to_action, tags].filter(Boolean).join('\n\n')
}

export async function copyText(text, label, message) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`Đã sao chép ${label}.`)
  } catch {
    message.error('Trình duyệt chặn sao chép. Hãy chọn và sao chép thủ công.')
  }
}

// Facebook chỉ dựng thẻ xem trước cho link công khai; link localhost hiện dạng chữ.
export function isPublicLink(link) {
  try {
    const { hostname } = new URL(link)
    return hostname.includes('.') && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  } catch {
    return false
  }
}
