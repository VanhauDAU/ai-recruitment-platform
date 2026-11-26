import { ReloadOutlined } from '@ant-design/icons'
import { BrandLogo } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

/**
 * Màn bảo trì (tải lazy: chỉ cần khi admin bật chế độ bảo trì). CSS và hình bánh
 * răng nằm ở public/maintenance, dùng chung với trang lỗi 50x.html của nginx.
 */
export default function MaintenanceScreen({ message, contact }) {
  return (
    <main className="maintenance">
      <link rel="stylesheet" href="/maintenance/maintenance.css" precedence="default" />
      <div className="maintenance__content">
        <BrandLogo variant="full" imageClassName="maintenance__logo" />
        <img className="maintenance__art" src="/maintenance/gears.svg" alt="" width="410" height="345" />
        <h1 className="maintenance__title">
          {m.common_maintenance_title_lead()} <span>{m.common_maintenance_title_highlight()}</span>
        </h1>
        <p className="maintenance__message">{message}</p>
        {contact && <p className="maintenance__contact">{m.common_maintenance_contact({ contact })}</p>}
        <button type="button" className="maintenance__retry" onClick={() => window.location.reload()}>
          <ReloadOutlined aria-hidden="true" />
          {m.common_maintenance_retry()}
        </button>
      </div>
    </main>
  )
}
