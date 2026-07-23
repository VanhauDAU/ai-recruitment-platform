import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordForm from './ChangePasswordForm'

const mocks = vi.hoisted(() => ({
  changeCurrentPassword: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  clearCurrentSession: vi.fn(),
  onSetCurrentUser: vi.fn(),
  setTokens: vi.fn(),
  user: null,
}))

vi.mock('../api/change-password.api', () => ({
  changeCurrentPassword: mocks.changeCurrentPassword,
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({
    user: mocks.user,
    clearCurrentSession: mocks.clearCurrentSession,
    setCurrentUser: mocks.onSetCurrentUser,
  }),
}))
vi.mock('@/shared/api/token-store', () => ({ setTokens: mocks.setTokens }))
vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

function renderForm(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <App>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/start']}>
          <Routes>
            <Route path="/start" element={<ChangePasswordForm {...props} />} />
            <Route path="/employer-phone" element={<p>Đích xác thực employer</p>} />
            <Route path="/login" element={<p>Đăng nhập lại an toàn</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </App>,
  )
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    mocks.changeCurrentPassword.mockReset()
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
    mocks.onSetCurrentUser.mockReset()
    mocks.clearCurrentSession.mockReset()
    mocks.setTokens.mockReset()
    mocks.user = {
      email: 'candidate@example.com',
      has_usable_password: true,
    }
  })

  it('shows the candidate email read-only and accepts the backend password policy without requiring a special character', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const result = {
      detail: 'Cập nhật mật khẩu thành công.',
      tokens: { access: 'next-access' },
      user: { ...mocks.user, full_name: 'Ứng viên' },
    }
    mocks.changeCurrentPassword.mockResolvedValue(result)

    renderForm({ onSuccess, showEmail: true })

    expect(screen.getByLabelText('Email đăng nhập')).toHaveValue('candidate@example.com')
    expect(screen.getByLabelText('Email đăng nhập')).toHaveAttribute('readonly')
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'CurrentPassword1')
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'CareerFlow872')
    expect(screen.getByText('Đạt yêu cầu cơ bản')).toBeInTheDocument()
    expect(screen.queryByText('Mật khẩu mạnh')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'CareerFlow872')
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => expect(mocks.changeCurrentPassword).toHaveBeenCalled())
    expect(mocks.changeCurrentPassword.mock.calls[0][0]).toEqual({
      current_password: 'CurrentPassword1',
      password: 'CareerFlow872',
      logout_all_sessions: false,
    })
    expect(mocks.setTokens).toHaveBeenCalledWith({ access: 'next-access' })
    expect(mocks.onSetCurrentUser).toHaveBeenCalledWith(result.user)
    expect(onSuccess).toHaveBeenCalledWith(result)
  })

  it('uses neutral first-password copy for an account without a usable password', () => {
    mocks.user = {
      email: 'candidate@example.com',
      has_usable_password: false,
    }

    renderForm({ showEmail: true })

    expect(screen.getByRole('alert')).toHaveTextContent('Tài khoản chưa có mật khẩu đăng nhập')
    expect(screen.getByRole('alert')).toHaveTextContent('đăng nhập trực tiếp bằng email')
    expect(screen.queryByText(/Google|xác thực số điện thoại/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo mật khẩu' })).toBeInTheDocument()
  })

  it('keeps the employer success redirect when the caller provides it', async () => {
    const user = userEvent.setup()
    mocks.changeCurrentPassword.mockResolvedValue({
      detail: 'Đã đổi mật khẩu.',
      user: mocks.user,
    })

    renderForm({ successRedirect: '/employer-phone' })

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'CurrentPassword1')
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Updated1')
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'Updated1')
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    expect(await screen.findByText('Đích xác thực employer')).toBeInTheDocument()
  })

  it('shows backend-only password validation errors on the password field', async () => {
    const user = userEvent.setup()
    mocks.changeCurrentPassword.mockRejectedValue({
      response: { data: { password: ['Mật khẩu này quá phổ biến.'] } },
    })

    renderForm()

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'CurrentPassword1')
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Password1')
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    expect(await screen.findByText('Mật khẩu này quá phổ biến.')).toBeInTheDocument()
  })

  it('offers a safe reauthentication action when an OAuth session is too old', async () => {
    const user = userEvent.setup()
    mocks.user = {
      email: 'candidate@example.com',
      has_usable_password: false,
    }
    mocks.changeCurrentPassword.mockRejectedValue({
      response: {
        status: 403,
        data: {
          detail: 'Hãy đăng nhập lại với OAuth trước khi tạo mật khẩu.',
          code: 'reauth_required',
        },
      },
    })

    renderForm({ showEmail: true, reauthPath: '/login' })

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'CareerFlow872')
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'CareerFlow872')
    await user.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))

    expect(await screen.findByText('Cần đăng nhập lại để tạo mật khẩu')).toBeInTheDocument()
    expect(screen.queryByText('reauth_required')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đăng nhập lại' }))
    expect(mocks.clearCurrentSession).toHaveBeenCalledOnce()
    expect(await screen.findByText('Đăng nhập lại an toàn')).toBeInTheDocument()
  })
})
