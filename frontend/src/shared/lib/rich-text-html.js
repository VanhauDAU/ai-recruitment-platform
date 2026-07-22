const ENCODED_RICH_TEXT_TAG = /&(?:amp;)*(?:lt);\/?[a-z][^&]*&(?:amp;)*(?:gt);/i

// Dữ liệu cũ có thể đã bị encode một hoặc nhiều lần trước khi lưu.
// Chỉ decode khi chuỗi thực sự chứa thẻ HTML để không làm thay đổi văn bản thường.
export function normalizeRichTextHtml(value) {
  if (typeof value !== 'string' || !ENCODED_RICH_TEXT_TAG.test(value)) return value || ''

  let normalized = value
  for (let index = 0; index < 3 && ENCODED_RICH_TEXT_TAG.test(normalized); index += 1) {
    normalized = normalized
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
  }
  return normalized
}
