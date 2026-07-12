// Dựng URL chi tiết việc làm — nơi duy nhất quyết định tin dùng URL nào.
// Mô phỏng luồng: công ty có trang thương hiệu (brand_slug khác null)
// thì tin mở dưới /brand/<công-ty>/tuyen-dung/<tin>, ngược lại /viec-lam/<tin>.
// Dữ liệu thiếu brand_slug (vd endpoint stats) cứ trả URL thường — trang chi
// tiết sẽ tự redirect sang URL brand chuẩn nếu có.
export function jobDetailPath(job) {
  if (!job?.slug) return '/viec-lam'
  return job.brand_slug
    ? `/brand/${job.brand_slug}/tuyen-dung/${job.slug}`
    : `/viec-lam/${job.slug}`
}

export default jobDetailPath
