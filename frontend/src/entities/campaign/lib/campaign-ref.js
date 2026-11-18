// Mã nguồn chiến dịch (?ref= từ link theo dõi), dùng khi ứng viên ứng tuyển.
// Có consent Analytics thì nhớ 30 ngày, lần bấm cuối thắng; không có thì chỉ
// nhớ trong phiên SPA đang mở. Server tự kiểm chữ ký và hạn 30 ngày.

export const CAMPAIGN_REF_STORAGE_KEY = 'procv_campaign_ref_v1'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

let sessionRef = ''

export function storeCampaignRef(ref, { persist }) {
  sessionRef = ref
  if (!persist) return
  try {
    localStorage.setItem(CAMPAIGN_REF_STORAGE_KEY, JSON.stringify({ ref, capturedAt: Date.now() }))
  } catch {
    // Không lưu được thì vẫn còn bản trong phiên.
  }
}

export function readCampaignRef() {
  if (sessionRef) return sessionRef
  try {
    const stored = JSON.parse(localStorage.getItem(CAMPAIGN_REF_STORAGE_KEY))
    if (stored?.ref && Date.now() - stored.capturedAt < MAX_AGE_MS) return stored.ref
  } catch {
    // Dữ liệu hỏng coi như không có nguồn.
  }
  return ''
}

export function clearStoredCampaignRef() {
  try {
    localStorage.removeItem(CAMPAIGN_REF_STORAGE_KEY)
  } catch {
    // Bỏ qua khi trình duyệt chặn bộ nhớ.
  }
}
