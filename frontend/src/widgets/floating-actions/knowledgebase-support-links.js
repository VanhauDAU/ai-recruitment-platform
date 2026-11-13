const KNOWLEDGEBASE_SUPPORT_LINKS = [
  {
    key: 'safety',
    label: 'Hướng dẫn tìm việc an toàn',
    path: '/tro-giup/tim-viec-an-toan',
    required: true,
  },
  {
    key: 'faq',
    label: 'Các câu hỏi thường gặp',
    path: '/tro-giup',
  },
]

export function knowledgebaseSupportLinks(enabled) {
  return enabled ? KNOWLEDGEBASE_SUPPORT_LINKS : []
}
