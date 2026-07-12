import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoleGuard from './RoleGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

describe('RoleGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('redirects a user whose role is not allowed', () => {
    useSession.mockReturnValue({ user: { role: 'candidate' } })

    render(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <Routes>
          <Route path="/admin/app/login" element={<p>Admin login</p>} />
          <Route element={<RoleGuard allowedRoles={['admin']} loginPath="/admin/app/login" />}>
            <Route path="/admin/app/dashboard" element={<p>Admin dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin login')).toBeInTheDocument()
  })

  it('renders content for an allowed role', () => {
    useSession.mockReturnValue({ user: { role: 'admin' } })

    render(
      <MemoryRouter initialEntries={['/admin/app/dashboard']}>
        <Routes>
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/app/dashboard" element={<p>Admin dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
  })
})
