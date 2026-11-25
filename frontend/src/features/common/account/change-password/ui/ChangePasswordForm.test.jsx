import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordForm from './ChangePasswordForm'

const mocks = vi.hoisted(() => ({
  changeCurrentPassword: vi.fn(),
  getPasswordSetupRequirements: vi.fn(),
  sendPasswordSetupCode: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  onSetCurrentUser: vi.fn(),
  setTokens: vi.fn(),
  user: null,
}))

vi.mock('../api/change-password.api', () => ({
  changeCurrentPassword: mocks.changeCurrentPassword,
  getPasswordSetupRequirements: mocks.getPasswordSetupRequirements,
  sendPasswordSetupCode: mocks.sendPasswordSetupCode,
}))
vi.mock('@/entities/account/session', () => ({
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
      requires_email_code: true,
      email_code_ttl_seconds: 600,
      resend_after_seconds: 0,
    })
    mocks.sendPasswordSetupCode.mockReset()
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
    mocks.message.warning.mockReset()
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

  it('asks an account without a password for an emailed code instead of a provider sign-in', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.sendPasswordSetupCode.mockResolvedValue({ resend_after_seconds: 60 })
    mocks.changeCurrentPassword.mockResolvedValue({ user: mocks.user, tokens: { access: 'a' } })

    renderForm({ showEmail: true })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tài khoản chưa có mật khẩu đăng nhập')
    expect(alert).toHaveTextContent('candidate@example.com')
    expect(alert).toHaveTextContent('10 phút')
    expect(screen.queryByText(/Xác thực với|Google/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }))
    await waitFor(() => expect(mocks.sendPasswordSetupCode).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: /Gửi lại sau \d+s/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Mã xác minh qua email'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))

    await waitFor(() => expect(mocks.changeCurrentPassword).toHaveBeenCalled())
    expect(mocks.changeCurrentPassword.mock.calls[0][0]).toMatchObject({ email_code: '123456', password: 'CareerFlow872' })
  })

  it('shows a wrong or expired code on the code field', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.changeCurrentPassword.mockRejectedValue({
      response: { status: 400, data: { email_code: ['Mã xác minh không đúng hoặc đã hết hạn.'] } },
    })

    renderForm({ showEmail: true })

    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('Mã xác minh qua email'), { target: { value: '000000' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))

    expect(await screen.findByText('Mã xác minh không đúng hoặc đã hết hạn.')).toBeInTheDocument()
  })

  it('creates the password without a code right after a Google sign-in, then asks for one when the window ends', async () => {
    mocks.user = { email: 'candidate@example.com', has_usable_password: false }
    mocks.getPasswordSetupRequirements.mockResolvedValue({ requires_email_code: false })
    mocks.changeCurrentPassword.mockRejectedValueOnce({
      response: { status: 400, data: { email_code: ['Nhập mã xác minh gửi tới email.'] } },
    })
    mocks.changeCurrentPassword.mockResolvedValue({ user: mocks.user })

    renderForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('không cần mã xác minh')
    expect(screen.queryByLabelText('Mã xác minh qua email')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'CareerFlow872' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))

    // Server hết miễn mã giữa chừng: hiện ô mã, giữ nguyên mật khẩu đã nhập.
    const codeInput = await screen.findByLabelText('Mã xác minh qua email')
    expect(mocks.changeCurrentPassword.mock.calls[0][0]).not.toHaveProperty('email_code')
    expect(mocks.message.warning).toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Gửi mã')
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('CareerFlow872')

    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))
    await waitFor(() => expect(mocks.changeCurrentPassword).toHaveBeenCalledTimes(2))
    expect(mocks.changeCurrentPassword.mock.calls[1][0]).toMatchObject({ email_code: '123456' })
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

  it('defaults to revoking other sessions when the admin caller requests it', async () => {
    mocks.changeCurrentPassword.mockResolvedValue({
      detail: 'Đã đổi mật khẩu.',
      user: mocks.user,
    })

    renderForm({ defaultLogoutAllSessions: true })

    expect(screen.getByRole('checkbox', {
      name: 'Đăng xuất khỏi các thiết bị khác',
    })).toBeChecked()
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

    await waitFor(() => {
      expect(mocks.changeCurrentPassword.mock.calls[0][0]).toEqual({
        current_password: 'CurrentPassword1',
        password: 'Updated1',
        logout_all_sessions: true,
      })
    })
  })
})
