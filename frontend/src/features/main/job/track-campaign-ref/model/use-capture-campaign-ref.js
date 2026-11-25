import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { clearStoredCampaignRef, storeCampaignRef } from '@/entities/campaign/campaign'
import { useConsent } from '@/entities/system/consent'

// Đọc ?ref= của link theo dõi chiến dịch rồi bỏ khỏi URL để link chia sẻ và
// canonical luôn sạch. Rút consent Analytics thì xóa bản đã lưu.
export function useCaptureCampaignRef() {
  const location = useLocation()
  const navigate = useNavigate()
  const { consent, status } = useConsent()
  // Khi đang tải, `consent` còn là bản sao localStorage có thể đã cũ: chờ máy
  // chủ xác nhận rồi mới quyết định có lưu lâu dài hay không.
  const settled = status !== 'loading'
  const analytics = status === 'ready' && consent?.analytics === true

  useEffect(() => {
    if (!settled) return
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref')
    if (!ref) return
    storeCampaignRef(ref, { persist: analytics })
    params.delete('ref')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true })
  }, [analytics, location.hash, location.pathname, location.search, navigate, settled])

  useEffect(() => {
    if (settled && !analytics) clearStoredCampaignRef()
  }, [analytics, settled])
}

export function CampaignRefCapture() {
  useCaptureCampaignRef()
  return null
}
