import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import EmployerAccountSettingsShell from './EmployerAccountSettingsShell'

describe('EmployerAccountSettingsShell', () => {
  it('sets a descriptive title for the current settings tab', () => {
    render(
      <MemoryRouter initialEntries={['/tuyendung/app/account/settings/password-login']}>
        <EmployerAccountSettingsShell title="Thay đổi mật khẩu">
          <p>Nội dung tab</p>
        </EmployerAccountSettingsShell>
      </MemoryRouter>,
    )

    expect(document.title).toBe('Thay đổi mật khẩu | Smart Recruitment Platform')
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' })).toHaveAttribute('aria-current', 'page')
  })
})
