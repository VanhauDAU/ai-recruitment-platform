import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AcceptAdminInvitation from './AcceptAdminInvitation'

const api = vi.hoisted(() => ({
  acceptAdminInvitation: vi.fn(),
  validateAdminInvitation: vi.fn(),
}))

vi.mock('@/entities/account/admin-account', () => ({
  acceptAdminInvitation: api.acceptAdminInvitation,
  adminAccountKeys: { all: ['admin-accounts'] },
  validateAdminInvitation: api.validateAdminInvitation,
}))

function renderFeature(path = '/quan-tri/loi-moi?token=signed-token') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AcceptAdminInvitation />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AcceptAdminInvitation', () => {
  beforeEach(() => {
    api.acceptAdminInvitation.mockReset()
    api.validateAdminInvitation.mockReset()
    api.validateAdminInvitation.mockResolvedValue({
      email: 'new-admin@example.com',
      full_name: 'Nguyễn Văn An',
      expires_at: '2026-12-01T00:00:00Z',
    })
  })

  it('validates the signed link and shows the invited email', async () => {
    renderFeature()
    expect(await screen.findByRole('heading', {
      name: 'Hoàn tất tài khoản quản trị',
    })).toBeInTheDocument()
    expect(screen.getByText('new-admin@example.com')).toBeInTheDocument()
    expect(api.validateAdminInvitation).toHaveBeenCalledWith(
      'signed-token',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('activates the account after setting a password', async () => {
    const user = userEvent.setup()
    api.acceptAdminInvitation.mockResolvedValue({
      user_public_id: 'usr_admin',
    })
    renderFeature()
    await screen.findByRole('heading', { name: 'Hoàn tất tài khoản quản trị' })

    const passwordFields = screen.getAllByLabelText(/Mật khẩu mới|Xác nhận mật khẩu/)
    await user.type(passwordFields[0], 'StrongPass123')
    await user.type(passwordFields[1], 'StrongPass123')
    await user.click(screen.getByRole('button', { name: 'Kích hoạt tài khoản' }))

    expect(await screen.findByText('Tài khoản Admin đã sẵn sàng')).toBeInTheDocument()
    expect(screen.getByText(/Đăng nhập cổng quản trị để bắt đầu làm việc/)).toBeInTheDocument()
    await waitFor(() => {
      expect(api.acceptAdminInvitation).toHaveBeenCalledWith({
        token: 'signed-token',
        password: 'StrongPass123',
        password_confirm: 'StrongPass123',
      })
    })
  })

  it('rejects a missing token before any API request', () => {
    renderFeature('/quan-tri/loi-moi')
    expect(screen.getByText('Liên kết mời không còn hiệu lực')).toBeInTheDocument()
    expect(api.validateAdminInvitation).not.toHaveBeenCalled()
  })
})
