import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router-dom'
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

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    await waitFor(() => expect(screen.getByText('Đăng xuất')).toBeInTheDocument())
    expect(screen.queryByText('Chuyển sang Nhà tuyển dụng')).not.toBeInTheDocument()
  })
})
