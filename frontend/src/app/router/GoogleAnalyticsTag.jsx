import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useConsent } from '@/entities/system/consent'
import { useSiteSetting } from '@/entities/system/site-settings'
import { isAdminPath } from '@/shared/config/portals'

// GA4 theo mã admin đặt ở Cấu hình → SEO; chỉ chạy khi đã đồng ý Hiệu năng và
// không đo cổng quản trị. Bộ tải nằm ở chunk riêng: đa số người xem chưa đồng ý
// nên không phải tải nó (ngân sách JS khởi tạo).
export default function GoogleAnalyticsTag() {
  const id = useSiteSetting('seo_ga4_measurement_id')
  const { consent, status } = useConsent()
  const adminArea = isAdminPath(useLocation().pathname)

  useEffect(() => {
    if (status === 'loading') return
    const allowed = consent.analytics && id
    if (!allowed && !window.gtag && !/(^|;\s*)_ga/.test(document.cookie)) return
    import('@/shared/lib/google-analytics').then((ga) => {
      if (!consent.analytics) {
        ga.pauseGoogleAnalytics(id)
        ga.clearGoogleAnalyticsCookies()
      } else if (adminArea) {
        ga.pauseGoogleAnalytics(id)
      } else {
        ga.enableGoogleAnalytics(id)
      }
    })
  }, [adminArea, consent.analytics, id, status])

  return null
}
