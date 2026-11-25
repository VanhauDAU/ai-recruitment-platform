const STANDARD_CARD_CLASS = 'border-gray-200 !bg-white'
// Thẻ là <a>: reset của antd (ngoài layer) xóa nền utility thường nên phải dùng `!bg-`.
const TOP_EMPLOYER_CARD_CLASS = 'border-[var(--brand-primary)]/25 !bg-[var(--brand-primary-soft)]/50'

/**
 * Quyền xuất hiện trong "Việc làm nổi bật" thuộc về tin tuyển dụng, còn nền
 * xanh là nhận diện cấp công ty. `brand_slug` là tín hiệu public hiện có cho
 * doanh nghiệp sở hữu trang thương hiệu riêng; không suy diễn màu từ gói tin.
 */
export function isTopEmployerJob(job = {}) {
  return Boolean(job.brand_slug)
}

export function bestJobCardClass(job = {}) {
  return isTopEmployerJob(job) ? TOP_EMPLOYER_CARD_CLASS : STANDARD_CARD_CLASS
}
