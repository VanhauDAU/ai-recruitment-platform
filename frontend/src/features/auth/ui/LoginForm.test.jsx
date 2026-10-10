import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

const mocks = vi.hoisted(() => ({
  executeRecaptcha: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  success: vi.fn(),
}))

vi.mock('react-google-recaptcha-v3', () => ({
  useGoogleReCaptcha: () => ({ executeRecaptcha: mocks.executeRecaptcha }),
}))

vi.mock('../api/auth.api', () => ({
  login: mocks.login,
  resendTwoFactorLogin: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({
    logout: mocks.logout,
    refreshSession: mocks.refreshSession,
  }),
}))

vi.mock('@/shared/lib/toast', () => ({
  message: { success: mocks.success },
}))

function renderLoginForm(props = {}) {
  return render(
    <MemoryRouter>
      <LoginForm
        portal="candidate"
        expectedRoles={['candidate']}
        onSuccess={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('LoginForm submit button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.executeRecaptcha.mockResolvedValue('captcha-token')
    mocks.refreshSession.mockResolvedValue({ role: 'candidate' })
  })

  it.each([
    ['candidate', 'default'],
    ['employer', 'employer'],
    ['admin', 'default'],
  ])('uses the shared animated button for the %s portal', (portal, appearance) => {
    renderLoginForm({ portal, appearance })

    const button = screen.getByTestId('login-submit')
    expect(button).toHaveAccessibleName('Đăng nhập')
    expect(button.querySelector('.submit-btn__track')).toBeInTheDocument()
    expect(button.querySelectorAll('.submit-btn__label')).toHaveLength(2)
  })

  it('allows only one login request while a submission is pending', async () => {
    let resolveLogin
    mocks.login.mockImplementation(
      () => new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLoginForm()

    fireEvent.change(screen.getByPlaceholderText('ten@congty.com'), {
      target: { value: 'candidate@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu của bạn'), {
      target: { value: 'secret-password' },
    })

    const button = screen.getByTestId('login-submit')
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledTimes(1)
    })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAccessibleName('Đang đăng nhập')
    expect(screen.getByPlaceholderText('ten@congty.com')).toBeDisabled()
    expect(screen.getByPlaceholderText('Nhập mật khẩu của bạn')).toBeDisabled()

    resolveLogin({})

    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    expect(mocks.success).toHaveBeenCalledWith('Đăng nhập thành công.', {
      className: 'app-toast--sound-done',
    })
    expect(button).toHaveAttribute('aria-busy', 'false')
  })

  it('drives the candidate mascot from email, password and visibility interactions', async () => {
    const { container } = renderLoginForm({ withMascot: true })
    const mascot = () => container.querySelector('.procv-mascot')
    const email = screen.getByPlaceholderText('ten@congty.com')
    const password = screen.getByPlaceholderText('Nhập mật khẩu của bạn')

    expect(mascot()).toHaveAttribute('data-pose', 'frameGrip')

    fireEvent.focus(email)
    expect(mascot()).toHaveAttribute('data-gaze', 'down')

    fireEvent.change(email, { target: { value: 'candidate@example.com' } })
    fireEvent.focus(password)
    fireEvent.change(password, { target: { value: 'secret-password' } })
    expect(mascot()).toHaveAttribute('data-pose', 'coverEyes')

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(mascot()).toHaveAttribute('data-pose', 'peek')

    fireEvent.blur(password)
    await waitFor(() => expect(mascot()).toHaveAttribute('data-pose', 'thumbsUp'))
  })

  it('shows a distinct mascot state when form validation blocks submit', async () => {
    const { container } = renderLoginForm({ withMascot: true })
    fireEvent.click(screen.getByTestId('login-submit'))

    await waitFor(() => {
      expect(container.querySelector('.auth-mascot-stage')).toHaveAttribute('data-state', 'invalid')
    })
    expect(screen.getByRole('status')).toHaveTextContent('chưa hợp lệ')
    expect(mocks.login).not.toHaveBeenCalled()
  })
})
