import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordForm from './ChangePasswordForm'

const mocks = vi.hoisted(() => ({
  changeCurrentPassword: vi.fn(),
  getPasswordSetupRequirements: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  onSetCurrentUser: vi.fn(),
  setTokens: vi.fn(),
  user: null,
}))

vi.mock('../api/change-password.api', () => ({
  changeCurrentPassword: mocks.changeCurrentPassword,
  getPasswordSetupRequirements: mocks.getPasswordSetupRequirements,
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({
    user: mocks.user,
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
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </App>,
  )
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    mocks.changeCurrentPassword.mockReset()
    mocks.getPasswordSetupRequirements.mockReset()
    mocks.getPasswordSetupRequirements.mockResolvedValue({
      has_usable_password: false,
      requires_reauth: false,
      reauth_provider: null,
      reauth_max_age_seconds: 300,
    })
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
    mocks.onSetCurrentUser.mockReset()
    mocks.setTokens.mockReset()
    mocks.user = {
      email: 'candidate@example.com',
      has_usable_password: true,
    }
  })

  it('shows the candidate email read-only and accepts the backend password policy without requiring a special character', async () => {
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
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'CurrentPassword1' },
    })
    const passwordInput = screen.getByLabelText('Mật khẩu mới')
    fireEvent.focus(passwordInput)
    await waitFor(() => {
      expect(screen.getByText('Chưa đạt yêu cầu')).toBeInTheDocument()
    })
    fireEvent.change(passwordInput, { target: { value: 'CareerFlow872' } })
    await waitFor(() => {
      expect(screen.getByText('Đạt yêu cầu cơ bản')).toBeInTheDocument()
    })
    expect(screen.queryByText('Mật khẩu mạnh')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'CareerFlow872' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

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

  it('uses neutral first-password copy for an account without a usable password', async () => {
    mocks.user = {
      email: 'candidate@example.com',
      has_usable_password: false,
    }

    renderForm({ showEmail: true })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tài khoản chưa có mật khẩu đăng nhập')
    expect(alert).toHaveTextContent('đăng nhập trực tiếp bằng email')
    expect(screen.queryByText(/Google|xác thực số điện thoại/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo mật khẩu' })).toBeEnabled()
  })

  it('keeps the employer success redirect when the caller provides it', async () => {
    mocks.changeCurrentPassword.mockResolvedValue({
      detail: 'Đã đổi mật khẩu.',
      user: mocks.user,
    })

    renderForm({ successRedirect: '/employer-phone' })

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'CurrentPassword1' },
    })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'Updated1' },
    })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'Updated1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    expect(await screen.findByText('Đích xác thực employer')).toBeInTheDocument()
  })

  it('shows backend-only password validation errors on the password field', async () => {
    mocks.changeCurrentPassword.mockRejectedValue({
      response: { data: { password: ['Mật khẩu này quá phổ biến.'] } },
    })

    renderForm()

    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), {
      target: { value: 'CurrentPassword1' },
    })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'Password1' },
    })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'Password1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    expect(await screen.findByText('Mật khẩu này quá phổ biến.')).toBeInTheDocument()
  })

  it('warns before the user fills the form when the OAuth session is no longer fresh', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.getPasswordSetupRequirements.mockResolvedValue({
      has_usable_password: false,
      requires_reauth: true,
      reauth_provider: 'google',
      reauth_max_age_seconds: 300,
    })
    const onReauth = vi.fn()

    renderForm({ showEmail: true, onReauth })

    expect(await screen.findByText('Xác thực lại với Google để tạo mật khẩu')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('trong vòng 5 phút')
    // Chặn ngay ở nút lưu: người dùng không điền xong rồi mới nhận 403.
    expect(screen.getByRole('button', { name: 'Tạo mật khẩu' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Xác thực với Google' }))
    expect(onReauth).toHaveBeenCalledWith('google')
    expect(mocks.changeCurrentPassword).not.toHaveBeenCalled()
  })

  it('falls back to the same reauthentication banner when the session expires mid-form', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.changeCurrentPassword.mockRejectedValue({
      response: {
        status: 403,
        data: {
          detail: 'Hãy xác thực lại bằng mạng xã hội trước khi tạo mật khẩu.',
          code: 'reauth_required',
          reauth_provider: 'facebook',
        },
      },
    })
    const onReauth = vi.fn()

    renderForm({ showEmail: true, onReauth })

    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), {
      target: { value: 'CareerFlow872' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))

    expect(await screen.findByText('Xác thực lại với Facebook để tạo mật khẩu')).toBeInTheDocument()
    expect(screen.queryByText('reauth_required')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực với Facebook' }))
    expect(onReauth).toHaveBeenCalledWith('facebook')
  })

  it('points to email recovery when there is no linked provider to reauthenticate with', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.getPasswordSetupRequirements.mockResolvedValue({
      has_usable_password: false,
      requires_reauth: true,
      reauth_provider: null,
      reauth_max_age_seconds: 300,
    })

    renderForm({ showEmail: true, onReauth: vi.fn() })

    expect(await screen.findByRole('alert')).toHaveTextContent('Quên mật khẩu')
    expect(screen.queryByRole('button', { name: /Xác thực với/ })).not.toBeInTheDocument()
  })
})
