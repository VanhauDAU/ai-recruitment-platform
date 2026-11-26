import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoleGuard from './RoleGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/account/session', () => ({ useSession }))

describe('RoleGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('redirects a user whose role is not allowed', () => {
    useSession.mockReturnValue({ user: { role: 'candidate' } })

    render(
      <MemoryRouter initialEntries={['/admin/app/tong-quan']}>
        <Routes>
          <Route path="/admin/app/dang-nhap" element={<p>Admin login</p>} />
          <Route element={<RoleGuard allowedRoles={['admin']} loginPath="/admin/app/dang-nhap" />}>
            <Route path="/admin/app/tong-quan" element={<p>Admin dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin login')).toBeInTheDocument()
  })

  it('renders content for an allowed role', () => {
    useSession.mockReturnValue({ user: { role: 'admin' } })

    render(
      <MemoryRouter initialEntries={['/admin/app/tong-quan']}>
        <Routes>
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/app/tong-quan" element={<p>Admin dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
  })
})
