const STANDARD_CARD_CLASS = 'border-slate-200 bg-white'
const TOP_EMPLOYER_CARD_CLASS = 'border-emerald-200 border-l-4 border-l-[#00b14f] bg-[#f2fbf6]'

/**
 * Quyền xuất hiện trong "Việc làm tốt nhất" thuộc về tin tuyển dụng, còn nền
 * xanh là nhận diện cấp công ty. `brand_slug` là tín hiệu public hiện có cho
 * doanh nghiệp sở hữu trang thương hiệu riêng; không suy diễn màu từ gói tin.
 */
export function isTopEmployerJob(job = {}) {
  return Boolean(job.brand_slug)
}

export function bestJobCardClass(job = {}) {
  return isTopEmployerJob(job) ? TOP_EMPLOYER_CARD_CLASS : STANDARD_CARD_CLASS
}
