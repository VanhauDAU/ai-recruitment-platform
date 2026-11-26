import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import EmployerAccountSettingsShell from './EmployerAccountSettingsShell'

describe('EmployerAccountSettingsShell', () => {
  it('marks the current settings tab and shows its heading', () => {
    render(
      <MemoryRouter initialEntries={['/tuyendung/app/cai-dat/mat-khau']}>
        <EmployerAccountSettingsShell title="Thay đổi mật khẩu">
          <p>Nội dung tab</p>
        </EmployerAccountSettingsShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Thay đổi mật khẩu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' })).toHaveAttribute('aria-current', 'page')
  })
})
