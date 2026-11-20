export const ACTION_COPY = {
  publish: ['Xuất bản', 'Nội dung này sẽ hiển thị cho ứng viên ngay lập tức.', 'Xuất bản'],
  archive: ['Gỡ bài viết', 'Bài sẽ biến mất khỏi phía ứng viên và bản sửa đang có sẽ bị hủy.', 'Gỡ bài'],
  restore: ['Khôi phục về nháp', 'Bài trở về nháp; xuất bản lại khi sẵn sàng.', 'Khôi phục'],
  'discard-draft': ['Hủy bản nháp', 'Thao tác này không thể hoàn tác.', 'Hủy bản nháp'],
}

const PUBLISH_EDIT_COPY = ['Xuất bản bản sửa', 'Bản sửa sẽ thay thế nội dung đang hiển thị cho ứng viên ngay lập tức.', 'Xuất bản']

export function getActionCopy(action, editorialState) {
  if (action === 'publish' && editorialState === 'published_with_draft') return PUBLISH_EDIT_COPY
  return ACTION_COPY[action]
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
