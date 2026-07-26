import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PasswordResetForm from './PasswordResetForm'

const api = vi.hoisted(() => ({
  confirmPasswordReset: vi.fn(),
  validatePasswordResetToken: vi.fn(),
}))

vi.mock('../api/auth.api', () => api)

function renderForm(path = '/admin/app/reset-password?token=admin-token') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PasswordResetForm
        portal="admin"
        requestPath="/admin/app/login"
        invalidActionLabel="Quay về đăng nhập"
      />
    </MemoryRouter>,
  )
}

describe('PasswordResetForm', () => {
  beforeEach(() => {
    api.confirmPasswordReset.mockReset()
    api.validatePasswordResetToken.mockReset()
    api.validatePasswordResetToken.mockResolvedValue({
      email: 'moderator@example.com',
      role: 'admin',
    })
  })

  it('binds the Admin reset screen to the admin portal', async () => {
    renderForm()

    expect(await screen.findByRole('heading', { name: 'Đặt lại mật khẩu quản trị' })).toBeInTheDocument()
    await waitFor(() => {
      expect(api.validatePasswordResetToken).toHaveBeenCalledWith(
        'admin-token',
        { portal: 'admin' },
      )
    })
  })

  it('offers only a return to Admin login for an invalid link', async () => {
    api.validatePasswordResetToken.mockRejectedValue(new Error('expired'))
    renderForm()

    expect(await screen.findByRole('link', { name: 'Quay về đăng nhập' }))
      .toHaveAttribute('href', '/admin/app/login')
  })
})
