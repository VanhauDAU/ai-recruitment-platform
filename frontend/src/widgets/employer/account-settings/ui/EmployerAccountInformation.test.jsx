import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import EmployerAccountInformation from './EmployerAccountInformation'

vi.mock('@/entities/account/session', () => ({
  useSession: () => ({
    user: { full_name: 'Nhà tuyển dụng', email: 'hr@example.com', email_verified: true, avatar_url: '', phone: '' },
    setCurrentUser: vi.fn(),
  }),
}))
vi.mock('@/entities/account/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  getEmployerProfile: vi.fn().mockResolvedValue({
    company_role: 'owner',
    verified_phone: '+84816548150',
    phone_verified_at: '2026-11-19T06:14:36Z',
    work_location: { id: 1, name: 'Thành phố Đà Nẵng' },
    created_at: '2026-11-19T06:10:17Z',
    company: { company_name: 'Công ty ABC', trade_name: 'ABC', logo_url: '' },
  }),
}))
vi.mock('@/features/common/account/edit-profile', () => ({
  updateProfile: vi.fn(),
  AvatarEditorModal: ({ open }) => (open ? <div role="dialog" aria-label="avatar-editor" /> : null),
}))

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><EmployerAccountInformation /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerAccountInformation', () => {
  it('shows who the account is on top: role, verified contact and company', async () => {
    renderCard()

    expect(await screen.findByRole('heading', { name: 'Nhà tuyển dụng' })).toBeInTheDocument()
    expect(screen.getByText('Người tạo công ty')).toBeInTheDocument()
    expect(screen.getByText('+84816548150')).toBeInTheDocument()
    expect(screen.getAllByText('Đã xác thực')).toHaveLength(2)
    expect(screen.getByText('Thành phố Đà Nẵng')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ABC/ })).toHaveAttribute('href', '/tuyendung/app/cai-dat/cong-ty')
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
  })

  it('opens the shared avatar editor from the camera button', async () => {
    renderCard()

    expect(screen.queryByRole('dialog', { name: 'avatar-editor' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Đổi avatar/ }))
    expect(screen.getByRole('dialog', { name: 'avatar-editor' })).toBeInTheDocument()
  })

  it('enables saving once a field changes', async () => {
    renderCard()

    await userEvent.type(await screen.findByLabelText('Họ và tên'), ' Mới')
    expect(screen.getByText('Bạn có thay đổi chưa lưu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
  })
})
