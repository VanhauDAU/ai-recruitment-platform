import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import IdentityRecoveryGuide from './IdentityRecoveryGuide'

const account = {
  email: 'recovered@example.com',
  email_verified: false,
  has_usable_password: false,
}

describe('IdentityRecoveryGuide', () => {
  it('explains the complete workflow and that no password is generated', () => {
    render(
      <IdentityRecoveryGuide
        account={{ ...account, email_verified: true, has_usable_password: true }}
        emailAction={<button type="button">Đổi email</button>}
        passwordResetAction={<button type="button">Gửi link</button>}
      />,
    )

    expect(screen.getByText('Khôi phục quyền truy cập'))
      .toBeInTheDocument()
    expect(screen.getByText(
      'Không có mật khẩu tạm — người dùng tự đặt mật khẩu mới qua email.',
    )).toBeInTheDocument()
    expect(screen.getByText('Quy trình bảo mật · 3 bước')).toBeInTheDocument()
    expect(screen.getAllByText('Đổi email')).toHaveLength(2)
    expect(screen.getByText('Người dùng hoàn tất')).toBeInTheDocument()
  })

  it('moves from password reset delivery to waiting for the user', () => {
    const { rerender } = render(
      <IdentityRecoveryGuide account={account} emailCompleted />,
    )

    expect(screen.getByText('Tiếp theo: gửi link đặt lại mật khẩu'))
      .toBeInTheDocument()

    rerender(
      <IdentityRecoveryGuide account={account} emailCompleted passwordResetSent />,
    )

    expect(screen.getByText('Đã gửi link — đang chờ người dùng'))
      .toBeInTheDocument()
  })
})
