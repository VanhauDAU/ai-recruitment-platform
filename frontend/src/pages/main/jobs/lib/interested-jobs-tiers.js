// Các tầng nới lỏng dần cho khối "Việc làm có thể bạn sẽ quan tâm" khi kết quả
// tìm kiếm rỗng. Nguyên tắc (giống TopCV): gợi ý theo NHU CẦU ĐÃ LƯU của ứng
// viên (chuyên môn + tỉnh/thành), không theo từ khóa vừa tìm thất bại; khách
// chưa có nhu cầu thì dùng bộ lọc đang chọn trên URL (bỏ từ khóa). Mỗi tầng nới
// bớt một tiêu chí: đủ cả -> chỉ chuyên môn -> việc mới nhất.
export const SUGGESTION_LIMIT = 6

function tierParams(categoryIds, locationIds) {
  // URLSearchParams để lặp key (category=1&category=2) đúng format backend đọc.
  const params = new URLSearchParams()
  categoryIds.forEach((id) => params.append('category', id))
  locationIds.forEach((id) => params.append('location', id))
  params.set('page_size', String(SUGGESTION_LIMIT))
  return params
}

export function buildInterestedJobTiers({ preference, selectedCategories = [], selectedLocations = [] }) {
  const categoryIds = preference?.desired_specializations?.length
    ? preference.desired_specializations.map((item) => item.id)
    : selectedCategories
  const locationIds = preference?.preferred_provinces?.length
    ? preference.preferred_provinces.map((item) => item.id)
    : selectedLocations

  const tiers = [
    tierParams(categoryIds, locationIds),
    tierParams(categoryIds, []),
    tierParams([], []),
  ]
  // Bỏ tầng trùng nhau (vd không có địa điểm thì tầng 1 trùng tầng 2).
  const seen = new Set()
  return tiers.filter((params) => {
    const key = params.toString()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
