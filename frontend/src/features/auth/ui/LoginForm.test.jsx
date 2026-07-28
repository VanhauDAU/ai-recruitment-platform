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
    expect(button).toHaveAttribute('aria-busy', 'false')
  })
})
