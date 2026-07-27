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

vi.mock('@/entities/admin-account', () => ({
  acceptAdminInvitation: api.acceptAdminInvitation,
  adminAccountKeys: { all: ['admin-accounts'] },
  validateAdminInvitation: api.validateAdminInvitation,
}))

function renderFeature(path = '/admin/app/invitation?token=signed-token') {
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
      target_role: {
        name: 'Nhân viên kiểm duyệt',
        department: { name: 'Kiểm duyệt tin' },
      },
    })
  })

  it('validates the signed link and displays the backend-selected role', async () => {
    renderFeature()
    expect(await screen.findByRole('heading', {
      name: 'Hoàn tất tài khoản quản trị',
    })).toBeInTheDocument()
    expect(screen.getByText('Kiểm duyệt tin')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên kiểm duyệt')).toBeInTheDocument()
    expect(api.validateAdminInvitation).toHaveBeenCalledWith(
      'signed-token',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('activates the account after setting a password without requiring MFA setup', async () => {
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
    expect(screen.getByText(/bật xác thực hai yếu tố sau trong phần Bảo mật/)).toBeInTheDocument()
    expect(screen.queryByText('MFA email')).not.toBeInTheDocument()
    expect(screen.queryByText('Mã dự phòng')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(api.acceptAdminInvitation).toHaveBeenCalledWith({
        token: 'signed-token',
        password: 'StrongPass123',
        password_confirm: 'StrongPass123',
      })
    })
  })

  it('rejects a missing token before any API request', () => {
    renderFeature('/admin/app/invitation')
    expect(screen.getByText('Liên kết mời không còn hiệu lực')).toBeInTheDocument()
    expect(api.validateAdminInvitation).not.toHaveBeenCalled()
  })
})
