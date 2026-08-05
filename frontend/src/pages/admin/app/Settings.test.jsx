import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSettings from './Settings'

const mocks = vi.hoisted(() => ({
  getAdminSettings: vi.fn(),
  refreshSiteSettings: vi.fn(),
  toastSuccess: vi.fn(),
  updateAdminSettings: vi.fn(),
}))

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ retry: mocks.refreshSiteSettings }),
}))

vi.mock('@/features/manage-site-settings', () => ({
  getAdminSettings: mocks.getAdminSettings,
  SettingField: ({ onChange }) => (
    <button type="button" onClick={() => onChange('#7c3aed')}>Chọn màu tím</button>
  ),
  updateAdminSettings: mocks.updateAdminSettings,
}))

vi.mock('@/shared/lib/toast', () => ({
  message: {
    error: vi.fn(),
    success: mocks.toastSuccess,
  },
}))

vi.mock('@/widgets/admin-workspace', () => ({
  AdminPanel: ({ children }) => <section>{children}</section>,
}))

describe('AdminSettings', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getAdminSettings.mockResolvedValue({
      groups: [{
        key: 'general',
        label: 'Chung',
        settings: [{
          key: 'brand_primary_color',
          label: 'Màu chủ đạo',
          value: '#00b14f',
          value_type: 'color',
          is_public: true,
        }],
      }],
    })
    mocks.updateAdminSettings.mockResolvedValue({
      updated: ['brand_primary_color'],
      errors: {},
      values: { brand_primary_color: '#7c3aed' },
    })
    mocks.refreshSiteSettings.mockResolvedValue(undefined)
  })

  it('refreshes the application theme after saving the primary color', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Chọn màu tím' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(mocks.refreshSiteSettings).toHaveBeenCalledOnce())
    expect(mocks.updateAdminSettings).toHaveBeenCalledWith(
      { brand_primary_color: '#7c3aed' },
      {},
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã lưu cấu hình.')
  })
})
