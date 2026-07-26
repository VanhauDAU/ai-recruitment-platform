export const ACTION_COPY = {
  submit: ['Gửi duyệt', 'Bài sẽ chuyển vào hàng chờ duyệt. Bạn vẫn có thể tiếp tục chỉnh sửa và gửi lại khi cần.', 'Gửi duyệt'],
  return: ['Trả về chỉnh sửa', 'Lý do sẽ xuất hiện trong timeline của người biên tập.', 'Trả bài'],
  publish: ['Xuất bản', 'Nội dung được duyệt sẽ thay thế bản public ngay lập tức.', 'Xuất bản'],
  archive: ['Gỡ bài viết', 'Bài sẽ biến mất khỏi phía ứng viên và bản sửa đang có sẽ bị hủy.', 'Gỡ bài'],
  restore: ['Khôi phục về nháp', 'Bài cần được gửi duyệt lại trước khi hiển thị.', 'Khôi phục'],
  'discard-draft': ['Hủy bản nháp', 'Thao tác này không thể hoàn tác.', 'Hủy bản nháp'],
}

const RESUBMIT_COPY = [
  'Gửi duyệt lại',
  'Các thay đổi mới nhất sẽ được cập nhật trong hàng chờ duyệt; bài vẫn có thể tiếp tục chỉnh sửa.',
  'Gửi duyệt lại',
]

export function getActionCopy(action, editorialState) {
  if (action === 'submit' && editorialState?.includes('pending')) return RESUBMIT_COPY
  return ACTION_COPY[action]
}

export function stateColor(state) {
  if (state === 'published') return 'green'
  if (state.includes('pending')) return 'gold'
  if (state === 'archived') return 'red'
  return 'blue'
}

export function toFormValues(version) {
  if (!version) return {}
  return {
    title: version.title,
    summary: version.summary,
    content: version.content,
    category_public_id: version.category?.public_id,
    tag_public_ids: version.tags?.map((tag) => tag.public_id) || [],
    related_job_category_id: version.related_job_category?.id || null,
    seo_title: version.seo_title,
    seo_description: version.seo_description,
    thumbnail_storage_key: version.thumbnail_storage_key,
    thumbnail_url: version.thumbnail_url,
  }
}
