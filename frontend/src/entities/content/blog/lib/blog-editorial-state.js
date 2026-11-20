/** Màu tag cho trạng thái biên tập blog: nháp, đã đăng, đã đăng kèm bản sửa nháp, đã gỡ. */
export function blogStateColor(state) {
  if (state === 'published') return 'green'
  if (state === 'published_with_draft') return 'gold'
  if (state === 'archived') return 'red'
  return 'blue'
}
