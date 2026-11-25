// Tách chữ thuần thành đoạn chữ/đường link. Không bao giờ dựng HTML: UI render
// từng đoạn thành text node hoặc <a>, nên nội dung tin không thể chèn thẻ.
const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi
const TRAILING_PUNCTUATION = /[.,!?;:)\]}'"…]+$/

export function linkifyParts(text = '') {
  const parts = []
  let cursor = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const url = raw.replace(TRAILING_PUNCTUATION, '')
    if (!url) continue
    if (match.index > cursor) parts.push({ type: 'text', value: text.slice(cursor, match.index) })
    parts.push({ type: 'link', value: url, href: url.startsWith('www.') ? `https://${url}` : url })
    cursor = match.index + url.length
  }
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) })
  return parts
}
