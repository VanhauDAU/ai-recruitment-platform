import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PermissionGuard from './PermissionGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

const route = {
  segment: '/settings',
  requireSuperuser: true,
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin/app/settings']}>
      <Routes>
        <Route
          path="/admin/app/settings"
          element={(
            <PermissionGuard route={route}>
              <p>Settings page</p>
            </PermissionGuard>
          )}
        />
        <Route
          path="/admin/app/access-denied"
          element={<p>Access denied</p>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PermissionGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('renders a superuser-only route immediately for a superuser', () => {
    useSession.mockReturnValue({
      user: { admin_access: { is_superuser: true } },
      refreshSession: vi.fn(),
    })
    renderGuard()
    expect(screen.getByText('Settings page')).toBeInTheDocument()
  })

  it('revalidates exactly once before redirecting a regular admin', async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      admin_access: { is_superuser: false },
    })
    useSession.mockReturnValue({
      user: { admin_access: { is_superuser: false } },
      refreshSession,
    })
    renderGuard()

    expect(await screen.findByText('Access denied')).toBeInTheDocument()
    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1))
  })
})
