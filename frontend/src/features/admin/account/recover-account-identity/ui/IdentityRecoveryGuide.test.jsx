import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import IdentityRecoveryGuide from './IdentityRecoveryGuide'

const account = {
  email: 'recovered@example.com',
  email_verified: false,
  has_usable_password: false,
}

describe('IdentityRecoveryGuide', () => {
  it('renders nothing until a recovery has started', () => {
    const { container } = render(
      <IdentityRecoveryGuide account={{ ...account, email_verified: true, has_usable_password: true }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('moves from password reset delivery to waiting for the user', () => {
    const { rerender } = render(
      <IdentityRecoveryGuide account={account} emailCompleted />,
    )

    expect(screen.getByText('Tiếp theo: gửi link đặt lại mật khẩu'))
      .toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Gửi link mật khẩu').closest('li')).toHaveAttribute('aria-current', 'step')

    rerender(
      <IdentityRecoveryGuide account={account} emailCompleted passwordResetSent />,
    )

    expect(screen.getByText('Đã gửi link — đang chờ người dùng'))
      .toBeInTheDocument()
  })
})
