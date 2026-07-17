// Đích đến sau khi hoàn tất onboarding: trang /viec-lam với bộ lọc dựng sẵn
// từ nhu cầu vừa lưu — danh mục chuyên môn đã chọn (`cat`), vị trí tự nhập
// làm từ khoá tìm kiếm (`search`) và tỉnh/thành đầu tiên (`locations` + path
// dạng /viec-lam/tai/<slug> giống link chia sẻ của trang việc làm).
function slugifyVietnamese(text = '') {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildPersonalizedJobsUrl(preference) {
  const params = new URLSearchParams()

  const categoryIds = (preference?.desired_specializations || []).map((item) => item.id)
  if (categoryIds.length) params.set('cat', categoryIds.join(','))

  const keyword = (preference?.desired_position_other || '').trim()
  if (keyword) params.set('search', keyword)

  let pathname = '/viec-lam'
  const province = preference?.preferred_provinces?.[0]
  if (province) {
    params.set('locations', String(province.id))
    const slug = slugifyVietnamese(String(province.name || '').replace(/^Thành phố |^Tỉnh /, ''))
    if (slug) pathname = `/viec-lam/tai/${slug}`
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
