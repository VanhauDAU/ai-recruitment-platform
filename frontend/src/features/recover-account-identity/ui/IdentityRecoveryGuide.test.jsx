import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import IdentityRecoveryGuide from './IdentityRecoveryGuide'

const account = {
  email: 'recovered@example.com',
  email_verified: false,
  has_usable_password: false,
  mfa_methods: {
    email: true,
    totp: true,
    backup_codes_remaining: 2,
  },
}

describe('IdentityRecoveryGuide', () => {
  it('explains the complete workflow and that no password is generated', () => {
    render(
      <IdentityRecoveryGuide
        account={{
          ...account,
          email_verified: true,
          has_usable_password: true,
          mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
        }}
        emailAction={<button type="button">Đổi email</button>}
        mfaAction={<button type="button">Reset MFA</button>}
        passwordResetAction={<button type="button">Gửi link</button>}
      />,
    )

    expect(screen.getByText('Khôi phục quyền truy cập'))
      .toBeInTheDocument()
    expect(screen.getByText(
      'Không có mật khẩu tạm — người dùng tự đặt mật khẩu mới qua email.',
    )).toBeInTheDocument()
    expect(screen.getAllByText('Đổi email')).toHaveLength(2)
    expect(screen.getByText('Người dùng hoàn tất')).toBeInTheDocument()
    expect(screen.getByText('Tài khoản không có phương thức MFA cần xử lý.'))
      .toBeInTheDocument()
  })

  it('directs the admin to reset MFA immediately after changing email', () => {
    render(
      <IdentityRecoveryGuide
        account={account}
        emailCompleted
        mfaAction={<button type="button">Đặt lại MFA</button>}
      />,
    )

    expect(screen.getByText('Tiếp theo: đặt lại MFA')).toBeInTheDocument()
    expect(screen.getByText(/link gửi trước bước này sẽ hết hiệu lực/i))
      .toBeInTheDocument()
  })

  it('moves from password reset delivery to waiting for the user', () => {
    const { rerender } = render(
      <IdentityRecoveryGuide
        account={{
          ...account,
          mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
        }}
        emailCompleted
        mfaCompleted
      />,
    )

    expect(screen.getByText('Tiếp theo: gửi link đặt lại mật khẩu'))
      .toBeInTheDocument()

    rerender(
      <IdentityRecoveryGuide
        account={{
          ...account,
          mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
        }}
        emailCompleted
        mfaCompleted
        passwordResetSent
      />,
    )

    expect(screen.getByText('Đã gửi link — đang chờ người dùng'))
      .toBeInTheDocument()
  })
})
