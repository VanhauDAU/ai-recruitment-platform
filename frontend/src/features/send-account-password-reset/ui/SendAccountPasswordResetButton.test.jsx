import { App } from 'antd'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SendAccountPasswordResetButton from './SendAccountPasswordResetButton'

const mocks = vi.hoisted(() => ({
  sendAdminAccountPasswordReset: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/admin-account', () => ({
  AccountVerificationSummary: ({ account }) => account
    ? <div>{`Đối chiếu: ${account.full_name} · ${account.email} · ${account.public_id}`}</div>
    : null,
  sendAdminAccountPasswordReset: mocks.sendAdminAccountPasswordReset,
}))
vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

describe('SendAccountPasswordResetButton', () => {
  beforeEach(() => {
    mocks.sendAdminAccountPasswordReset.mockReset()
    mocks.sendAdminAccountPasswordReset.mockResolvedValue({
      detail: 'Đã xếp lịch gửi email đặt lại mật khẩu.',
    })
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
  })

  it('requires an audit reason before sending the recovery email', async () => {
    const onSuccess = vi.fn()
    render(
      <App>
        <SendAccountPasswordResetButton
          account={{
            public_id: 'admin-1',
            full_name: 'Quản trị viên An',
            email: 'admin@example.com',
          }}
          publicId="admin-1"
          accountEmail="admin@example.com"
          onSuccess={onSuccess}
        />
      </App>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Gửi đặt lại mật khẩu/i }))
    expect(await screen.findByText('Đây là thao tác bảo mật nhạy cảm'))
      .toBeInTheDocument()
    expect(screen.getByText(
      'Đối chiếu: Quản trị viên An · admin@example.com · admin-1',
    )).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    expect(await screen.findByText('Nhập lý do gửi liên kết.')).toBeInTheDocument()
    expect(mocks.sendAdminAccountPasswordReset).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Lý do gửi liên kết'), {
      target: { value: 'Đã xác minh danh tính qua quy trình nội bộ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))

    await waitFor(() => {
      expect(mocks.sendAdminAccountPasswordReset).toHaveBeenCalledWith(
        'admin-1',
        { reason: 'Đã xác minh danh tính qua quy trình nội bộ' },
      )
    })
    expect(mocks.message.success)
      .toHaveBeenCalledWith('Đã xếp lịch gửi email đặt lại mật khẩu.')
    expect(onSuccess).toHaveBeenCalledWith({
      detail: 'Đã xếp lịch gửi email đặt lại mật khẩu.',
    })
  })
})
