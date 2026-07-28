import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import EmployerPasswordLogin from './PasswordLogin'

vi.mock('@/features/auth', () => ({
  getReturnUrl: (params) => params.get('returnUrl') || '',
  startOAuthReauth: vi.fn(),
}))

vi.mock('@/features/change-password', () => ({
  ChangePasswordForm: ({ successRedirect }) => (
    <span data-testid="success-redirect">{successRedirect || 'none'}</span>
  ),
}))

vi.mock('@/features/session-management', () => ({
  SessionManager: () => <span>Quản lý phiên</span>,
}))

vi.mock('@/widgets/employer-account-settings', () => ({
  EmployerAccountSettingsShell: ({ children }) => <main>{children}</main>,
}))

function renderPage(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EmployerPasswordLogin />
    </MemoryRouter>,
  )
}

describe('EmployerPasswordLogin', () => {
  it('stays on password settings after a normal password update', () => {
    renderPage('/tuyendung/app/account/settings/password-login')

    expect(screen.getByTestId('success-redirect')).toHaveTextContent('none')
  })

  it('returns to phone verification only when that flow requested it', () => {
    renderPage(
      '/tuyendung/app/account/settings/password-login'
      + '?returnUrl=%2Ftuyendung%2Fapp%2Faccount%2Fphone-verify',
    )

    expect(screen.getByTestId('success-redirect')).toHaveTextContent(
      '/tuyendung/app/account/phone-verify',
    )
  })

  it('ignores unrelated return destinations', () => {
    renderPage(
      '/tuyendung/app/account/settings/password-login'
      + '?returnUrl=%2Ftuyendung%2Fapp%2Fdashboard',
    )

    expect(screen.getByTestId('success-redirect')).toHaveTextContent('none')
  })
})
