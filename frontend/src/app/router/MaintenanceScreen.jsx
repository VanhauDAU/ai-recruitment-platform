import { ReloadOutlined, ToolOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { BrandLogo } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

/** Màn bảo trì (tải lazy: chỉ cần khi admin bật chế độ bảo trì). */
export default function MaintenanceScreen({ message, contact }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <BrandLogo variant="full" imageClassName="mx-auto h-9" />
        <ToolOutlined className="mt-6 text-4xl text-[var(--brand-primary)]" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">{m.common_maintenance_title()}</h1>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{message}</p>
        {contact && <p className="mt-4 text-sm text-gray-500">{m.common_maintenance_contact({ contact })}</p>}
        <Button className="mt-6" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
          {m.common_maintenance_retry()}
        </Button>
      </section>
    </main>
  )
}
