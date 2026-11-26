import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { subscribeToMaintenance } from '@/shared/api/maintenance-events'
import { m } from '@/shared/config/i18n'
import { isAdminPath } from '@/shared/config/portals'

const MaintenanceScreen = lazy(() => import('./MaintenanceScreen'))

/**
 * Chế độ bảo trì (ADR-0026): cổng ứng viên và nhà tuyển dụng thấy màn bảo trì,
 * cổng quản trị vẫn dùng được để tắt nó. Bật theo cấu hình công khai hoặc khi
 * API trả 503 `code=maintenance`.
 */
export default function MaintenanceGate({ children }) {
  const { pathname } = useLocation()
  const { settings, siteName } = useSiteSettings()
  const [reported, setReported] = useState(null)

  useEffect(() => subscribeToMaintenance((message) => setReported(message)), [])

  const isAdmin = isAdminPath(pathname)
  if (isAdmin || (settings.maintenance_mode !== true && reported === null)) return children

  const message = reported
    || settingText(settings.maintenance_message, m.common_maintenance_default_message({ site: siteName }))
  const contact = [settingText(settings.hotline), settingText(settings.support_email)].filter(Boolean).join(' · ')
  return (
    <Suspense fallback={null}>
      <MaintenanceScreen message={message} contact={contact} />
    </Suspense>
  )
}
