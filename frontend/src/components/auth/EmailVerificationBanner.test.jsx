import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmailVerificationBanner from './EmailVerificationBanner'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../hooks/useAuth', () => ({ useAuth }))

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    useAuth.mockReset()
  })

  it('shows for an unverified account even when the API does not provide provider', () => {
    useAuth.mockReturnValue({ user: { email_verified: false } })

    render(
      <BrowserRouter>
        <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
      </BrowserRouter>,
    )

    expect(screen.getByText(/Tài khoản của bạn chưa được xác thực/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'tại đây' })).toHaveAttribute('href', '/tai-khoan/xac-thuc-email')
  })

  it('does not show for a verified account', () => {
    useAuth.mockReturnValue({ user: { email_verified: true } })

    render(
      <BrowserRouter>
        <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
      </BrowserRouter>,
    )

    expect(screen.queryByText(/Tài khoản của bạn chưa được xác thực/)).not.toBeInTheDocument()
  })
})
