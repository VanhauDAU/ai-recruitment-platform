import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSettings from './Settings'

const mocks = vi.hoisted(() => ({
  getAdminSettings: vi.fn(),
  getSettingHistory: vi.fn(),
  getSystemParameters: vi.fn(),
  refreshSiteSettings: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateAdminSettings: vi.fn(),
}))

vi.mock('@/entities/system/site-settings', () => ({
  useSiteSettings: () => ({ retry: mocks.refreshSiteSettings }),
}))
vi.mock('@/features/admin/system/manage-ai-runtime', () => ({ AiRuntimeOverview: () => null }))
vi.mock('@/features/admin/system/manage-site-settings/api/manage-site-settings.api', () => ({
  getAdminSettings: mocks.getAdminSettings,
  getSettingHistory: mocks.getSettingHistory,
  getSystemParameters: mocks.getSystemParameters,
  updateAdminSettings: mocks.updateAdminSettings,
}))
vi.mock('@/shared/lib/toast', () => ({
  message: { error: mocks.toastError, success: mocks.toastSuccess },
}))

const setting = (key, overrides = {}) => ({
  key,
  label: key,
  section: 'Chung',
  value: '',
  default_value: '',
  value_type: 'text',
  options: {},
  description: `Mô tả ${key}`,
  help: '',
  is_public: false,
  ...overrides,
})

const GROUPS = [
  {
    key: 'brand',
    label: 'Thương hiệu',
    area: 'content',
    area_label: 'Giao diện & nội dung',
    settings: [
      setting('site_name', {
        label: 'Tên site', section: 'Nhận diện', value: 'ProCV', default_value: 'ProCV', is_public: true,
        help: 'Dùng ở header và email.', options: { applies_to: ['Email'] },
      }),
      setting('site_tagline', { label: 'Slogan', section: 'Nhận diện', value: 'Cũ' }),
    ],
  },
  {
    key: 'operations',
    label: 'Vận hành',
    area: 'compliance',
    area_label: 'Tuân thủ & vận hành',
    settings: [
      setting('maintenance_mode', {
        label: 'Chế độ bảo trì', section: 'Bảo trì', value: false, default_value: false,
        value_type: 'boolean', options: { risky: 'on' },
      }),
      setting('maintenance_message', {
        label: 'Thông báo bảo trì', section: 'Bảo trì', value: 'Đang bảo trì', options: { depends_on: 'maintenance_mode' },
      }),
    ],
  },
]

const renderPage = (url = '/quan-tri/cau-hinh') => render(
  <MemoryRouter initialEntries={[url]}>
    <AdminSettings />
  </MemoryRouter>,
)

describe('AdminSettings', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getAdminSettings.mockResolvedValue({ groups: structuredClone(GROUPS) })
    mocks.getSystemParameters.mockResolvedValue([])
    mocks.refreshSiteSettings.mockResolvedValue(undefined)
  })

  it('groups the sidebar by area, opens a legacy group link and explains a setting', async () => {
    const user = userEvent.setup()
    renderPage('/quan-tri/cau-hinh?group=general')

    expect(await screen.findByText('Giao diện & nội dung')).toBeInTheDocument()
    expect(screen.getByText('Tuân thủ & vận hành')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ProCV')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Giải thích: Tên site'))

    expect(await screen.findByText('Dùng ở header và email.')).toBeInTheDocument()
    expect(screen.getByText('site_name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('saves pending edits and refreshes public settings', async () => {
    const user = userEvent.setup()
    mocks.updateAdminSettings.mockResolvedValue({
      updated: ['site_name'], errors: {}, values: { site_name: 'Việc Tốt' },
    })
    renderPage()

    const input = await screen.findByDisplayValue('ProCV')
    await user.clear(input)
    await user.type(input, 'Việc Tốt')
    expect(screen.getByText('1 thay đổi chưa lưu')).toBeInTheDocument()
    await user.click(screen.getByText('Lưu thay đổi'))

    await waitFor(() => expect(mocks.updateAdminSettings).toHaveBeenCalledWith({ site_name: 'Việc Tốt' }, {}))
    expect(mocks.refreshSiteSettings).toHaveBeenCalledOnce()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã lưu cấu hình.')
    expect(await screen.findByText('Chưa có thay đổi')).toBeInTheDocument()
  })

  it('reverts a single field and searches across groups', async () => {
    const user = userEvent.setup()
    renderPage()

    const tagline = await screen.findByDisplayValue('Cũ')
    await user.type(tagline, ' mới')
    await user.click(screen.getByLabelText('Hoàn tác mục này'))
    expect(screen.getByDisplayValue('Cũ')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tìm cấu hình'), 'bảo trì')
    expect(screen.getByText('2 kết quả cho "bảo trì"')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('ProCV')).not.toBeInTheDocument()
    expect(screen.getByText('Bật "Chế độ bảo trì" để dùng mục này.')).toBeInTheDocument()
  })

  it('asks before a risky change and shows per-field errors after a partial save', async () => {
    const user = userEvent.setup()
    mocks.updateAdminSettings.mockResolvedValue({
      updated: ['maintenance_mode'],
      errors: { maintenance_message: 'Tối đa 5 ký tự.' },
      values: { maintenance_mode: true },
    })
    renderPage('/quan-tri/cau-hinh?group=operations')

    fireEvent.click(await screen.findByRole('switch'))
    await user.type(screen.getByDisplayValue('Đang bảo trì'), '!')
    await user.click(screen.getByText('Lưu thay đổi'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Chế độ bảo trì: Tắt → Bật')
    fireEvent.click(within(dialog).getByText('Lưu thay đổi'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tối đa 5 ký tự.')
    expect(mocks.toastError).toHaveBeenCalledWith('1 mục chưa lưu được, xem lỗi ngay dưới từng mục.')
  })

  it('opens the change history of a setting', async () => {
    const user = userEvent.setup()
    mocks.getSettingHistory.mockResolvedValue([
      { id: 'a1', created_at: '2026-11-20T08:00:00Z', actor: 'root@example.com', before: 'Cũ hơn', after: 'Cũ' },
    ])
    renderPage()

    await user.click(await screen.findByLabelText('Giải thích: Slogan'))
    await user.click(await screen.findByText('Xem lịch sử thay đổi'))

    expect(await screen.findByText(/root@example.com/)).toBeInTheDocument()
    expect(screen.getByText('Cũ hơn')).toBeInTheDocument()
    expect(mocks.getSettingHistory).toHaveBeenCalledWith('site_tagline')
  })
})
