import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PermissionGuard from './PermissionGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

const route = {
  segment: '/job-moderation',
  permission: 'job_moderation.view',
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin/app/job-moderation']}>
      <Routes>
        <Route
          path="/admin/app/job-moderation"
          element={(
            <PermissionGuard route={route}>
              <p>Moderation page</p>
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

  it('renders immediately when the session contains the permission', () => {
    useSession.mockReturnValue({
      user: {
        admin_access: {
          permissions: ['job_moderation.view'],
          memberships: [],
        },
      },
      refreshSession: vi.fn(),
    })
    renderGuard()
    expect(screen.getByText('Moderation page')).toBeInTheDocument()
  })

  it('revalidates exactly once before redirecting', async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      admin_access: { permissions: [], memberships: [] },
    })
    useSession.mockReturnValue({
      user: { admin_access: { permissions: [], memberships: [] } },
      refreshSession,
    })
    renderGuard()

    expect(await screen.findByText('Access denied')).toBeInTheDocument()
    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1))
  })
})
