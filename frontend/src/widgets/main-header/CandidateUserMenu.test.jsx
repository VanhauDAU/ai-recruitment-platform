import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import CandidateUserMenu from './CandidateUserMenu'

describe('CandidateUserMenu', () => {
  it('does not show an employer-portal shortcut', async () => {
    render(
      <App>
        <MemoryRouter>
          <CandidateUserMenu
            user={{
              public_id: 'candidate-1',
              full_name: 'Nguyễn An',
              email: 'candidate@example.com',
              email_verified: true,
            }}
            logout={vi.fn()}
          />
        </MemoryRouter>
      </App>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    await waitFor(() => expect(screen.getByText('Đăng xuất')).toBeInTheDocument())
    expect(screen.queryByText('Chuyển sang Nhà tuyển dụng')).not.toBeInTheDocument()
  })

  it('keeps one compact accordion section open at a time', async () => {
    render(
      <App>
        <MemoryRouter>
          <CandidateUserMenu user={{ email: 'candidate@example.com' }} logout={vi.fn()} />
        </MemoryRouter>
      </App>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))
    const searchSection = await screen.findByRole('button', { name: /Quản lý tìm việc/ })
    const cvSection = screen.getByRole('button', { name: /Quản lý CV & Cover letter/ })

    expect(searchSection).toHaveAttribute('aria-expanded', 'true')
    expect(cvSection).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(cvSection)

    expect(searchSection).toHaveAttribute('aria-expanded', 'false')
    expect(cvSection).toHaveAttribute('aria-expanded', 'true')
    const closedPanel = document.getElementById(searchSection.getAttribute('aria-controls'))
    expect(closedPanel).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Việc làm đã lưu', hidden: true })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('opens the section that owns the current account route', async () => {
    render(
      <App>
        <MemoryRouter initialEntries={['/tai-khoan/doi-mat-khau']}>
          <CandidateUserMenu user={{ email: 'candidate@example.com' }} logout={vi.fn()} />
        </MemoryRouter>
      </App>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    expect(
      await screen.findByRole('button', { name: /Cá nhân & Bảo mật/ }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
