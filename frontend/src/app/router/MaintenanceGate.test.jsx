import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { notifyMaintenance } from '@/shared/api/maintenance-events'
import MaintenanceGate from './MaintenanceGate'

const site = vi.hoisted(() => ({ settings: {} }))

vi.mock('@/entities/system/site-settings', async (importOriginal) => ({
  ...await importOriginal(),
  useSiteSettings: () => ({ settings: site.settings }),
}))
// Màn hình thật là chunk lazy (e2e site-switches kiểm tra giao diện); ở đây chỉ kiểm logic gate.
vi.mock('./MaintenanceScreen', () => ({
  default: ({ message, contact }) => <section><p>{message}</p><p>{contact}</p></section>,
}))

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <MaintenanceGate><p>Nội dung trang</p></MaintenanceGate>
  </MemoryRouter>,
)

describe('MaintenanceGate', () => {
  it('replaces candidate pages with the maintenance screen but keeps the admin portal', async () => {
    site.settings = { maintenance_mode: true, maintenance_message: 'Nâng cấp tới 22h.', hotline: '1900 1234' }

    renderAt('/viec-lam')
    expect(await screen.findByText('Nâng cấp tới 22h.')).toBeInTheDocument()
    expect(screen.getByText('1900 1234')).toBeInTheDocument()
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument()
  })

  it('lets administrators through', () => {
    site.settings = { maintenance_mode: true }

    renderAt('/admin/app/cau-hinh')
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument()
  })

  it('switches to maintenance when the API reports it before settings refresh', async () => {
    site.settings = { maintenance_mode: false }
    renderAt('/')
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument()

    act(() => notifyMaintenance('Bảo trì khẩn.'))
    expect(await screen.findByText('Bảo trì khẩn.')).toBeInTheDocument()
  })
})
