import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminLogin from './Login'

vi.mock('@/features/auth', () => ({
  AuthLogo: () => <div>logo</div>,
  LoginForm: ({ forgotPasswordLink, passwordHelp }) => (
    <div data-testid="login-form" data-forgot-link={String(forgotPasswordLink)}>
      {passwordHelp}
    </div>
  ),
}))

describe('AdminLogin', () => {
  it('keeps public password recovery hidden and directs admins to trusted support', () => {
    render(<AdminLogin destinationResolver={vi.fn()} />)

    expect(screen.getByTestId('login-form')).toHaveAttribute('data-forgot-link', 'null')
    expect(screen.getByText(/quên mật khẩu\? liên hệ kỹ thuật/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /quên mật khẩu/i })).not.toBeInTheDocument()
  })
})
