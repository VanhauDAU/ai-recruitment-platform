import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { clearStoredCampaignRef, storeCampaignRef } from '@/entities/campaign/campaign'
import { useConsent } from '@/entities/system/consent'

// Đọc ?ref= của link theo dõi chiến dịch rồi bỏ khỏi URL để link chia sẻ và
// canonical luôn sạch. Rút consent Analytics thì xóa bản đã lưu.
export function useCaptureCampaignRef() {
  const location = useLocation()
  const navigate = useNavigate()
  const { consent } = useConsent()
  const analytics = consent?.analytics === true

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref')
    if (!ref) return
    storeCampaignRef(ref, { persist: analytics })
    params.delete('ref')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true })
  }, [analytics, location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!analytics) clearStoredCampaignRef()
  }, [analytics])
}

export function CampaignRefCapture() {
  useCaptureCampaignRef()
  return null
}
