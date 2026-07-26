import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AdminAccountSettings from './AdminAccountSettings'

vi.mock('./AdminProfilePanel', () => ({ default: () => <div>panel-profile</div> }))
vi.mock('./AdminSecurityPanel', () => ({ default: () => <div>panel-security</div> }))
vi.mock('./AdminMyAccessPanel', () => ({ default: () => <div>panel-access</div> }))
vi.mock('./AdminActivityPanel', () => ({ default: () => <div>panel-activity</div> }))

function renderAt(initialEntry = '/admin/app/account') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminAccountSettings />
    </MemoryRouter>,
  )
}

describe('AdminAccountSettings', () => {
  it('renders the four tabs and opens the profile panel by default', () => {
    renderAt()

    for (const label of ['Hồ sơ', 'Bảo mật', 'Quyền của tôi', 'Nhật ký hoạt động']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument()
    }
    expect(screen.getByText('panel-profile')).toBeInTheDocument()
  })

  it('deep-links to a tab from the query string', () => {
    renderAt('/admin/app/account?tab=access')

    expect(screen.getByText('panel-access')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Quyền của tôi/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to the profile tab for an unknown tab key', () => {
    renderAt('/admin/app/account?tab=khong-ton-tai')

    expect(screen.getByText('panel-profile')).toBeInTheDocument()
  })

  it('switches panels when another tab is clicked', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(screen.getByRole('tab', { name: /Bảo mật/ }))

    expect(await screen.findByText('panel-security')).toBeInTheDocument()
  })
})
