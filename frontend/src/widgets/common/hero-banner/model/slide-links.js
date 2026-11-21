import { COMPANY_JOBS_TAB, companyDetailPath } from '@/entities/company/company'
import { normalizePublicUrl } from '@/entities/content/banner'

export const MATCHING_JOBS_PATH = '/tai-khoan/viec-lam-phu-hop'

/** Đích khi bấm slide: link admin nhập, nếu trống thì trang công ty gắn kèm. */
export function slideHref(banner) {
  const url = normalizePublicUrl((banner.cta_url || '').trim())
  if (url) return url
  return banner.company ? companyDetailPath(banner.company) : ''
}

export function companyJobsHref(company) {
  return companyDetailPath(company, { tab: COMPANY_JOBS_TAB })
}
