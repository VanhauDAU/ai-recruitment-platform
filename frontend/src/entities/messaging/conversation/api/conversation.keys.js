// `portal` là 'candidate' hoặc 'employer' (trùng tiền tố đường dẫn API).
// Tin nhắn nằm ngoài nhánh `all(portal)`: làm mới danh sách/ngữ cảnh không được
// tải lại cả luồng tin (luồng tự bù bằng `after=<seq>`).
export const conversationKeys = {
  all: (portal) => ['conversations', portal],
  lists: (portal) => ['conversations', portal, 'list'],
  list: (portal, q = '') => ['conversations', portal, 'list', q],
  unread: (portal) => ['conversations', portal, 'unread'],
  detail: (portal, publicId) => ['conversations', portal, 'detail', publicId],
  messages: (portal, publicId) => ['conversation-messages', portal, publicId],
  appliedJobs: () => ['conversations', 'candidate', 'applied-jobs'],
  shareableCvs: () => ['conversations', 'candidate', 'shareable-cvs'],
  shareableJobs: () => ['conversations', 'employer', 'shareable-jobs'],
}
