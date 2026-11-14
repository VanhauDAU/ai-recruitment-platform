/**
 * Đoạn giới thiệu dạng văn bản thuần cho meta description. Chỉ đọc text từ một
 * document trơ của DOMParser (không chạy script, không tải tài nguyên) nên
 * không cần kéo bộ sanitize HTML vào bundle khởi tạo qua barrel của entity.
 */
export function companyProfileSummary(profile) {
  const about = (profile?.sections || []).find(
    (section) => section.type === 'rich_text' && section.key === 'about',
  )
  if (!about?.body_html) return ''
  const { body } = new DOMParser().parseFromString(about.body_html, 'text/html')
  body.querySelectorAll('script, style').forEach((node) => node.remove())
  return body.textContent.replace(/\s+/g, ' ').trim()
}
