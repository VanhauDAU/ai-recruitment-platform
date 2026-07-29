import { App } from 'antd'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AccountVerificationSummary from './AccountVerificationSummary'

const ACCOUNT = {
  public_id: 'usr-verification-1',
  email: 'linh.nguyen@example.com',
  full_name: 'Nguyễn Thu Linh',
  phone: '0901234567',
  role: 'candidate',
  status: 'active',
  email_verified: true,
  two_factor_enabled: true,
  active_session_count: 2,
  date_joined: '2026-01-12T08:15:00Z',
  last_login: '2026-07-28T10:30:00Z',
}

describe('AccountVerificationSummary', () => {
  it('shows the existing account facts an admin needs to verify identity', () => {
    render(
      <App>
        <AccountVerificationSummary account={ACCOUNT} />
      </App>,
    )

    expect(screen.getByRole('region', {
      name: 'Thông tin tài khoản cần đối chiếu',
    })).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Thu Linh')).toBeInTheDocument()
    expect(screen.getByText('linh.nguyen@example.com')).toBeInTheDocument()
    expect(screen.getByText('0901234567')).toBeInTheDocument()
    expect(screen.getByText('usr-verification-1')).toBeInTheDocument()
    expect(screen.getByText('Ứng viên')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Đã xác minh')).toBeInTheDocument()
    expect(screen.getByText('Đang bật')).toBeInTheDocument()
    expect(screen.getByText(/Không đọc sẵn dữ liệu/)).toBeInTheDocument()
  })

  it('handles profile fields that have not been collected', () => {
    render(
      <App>
        <AccountVerificationSummary
          account={{
            ...ACCOUNT,
            full_name: '',
            phone: '',
            last_login: null,
          }}
        />
      </App>,
    )

    expect(screen.getByText('Chưa cập nhật họ tên')).toBeInTheDocument()
    expect(screen.getByText('Chưa cập nhật / không có quyền xem')).toBeInTheDocument()
    expect(screen.getByText('Chưa từng đăng nhập')).toBeInTheDocument()
  })
})
