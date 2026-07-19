import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GuestGuard from './GuestGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

describe('GuestGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('redirects an authenticated candidate away from login and sign-up', () => {
    useSession.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      user: { role: 'candidate', job_preferences_configured: true },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/" element={<p>Candidate home</p>} />
          <Route element={<GuestGuard allowedRoles={['candidate']} />}>
            <Route path="/login" element={<p>Login page</p>} />
            <Route path="/sign-up" element={<p>Sign-up page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Candidate home')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('sends an unconfigured candidate to onboarding instead of an auth page', () => {
    useSession.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      user: { role: 'candidate', job_preferences_configured: false },
    })

    render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <Routes>
          <Route path="/onboard-user" element={<p>Candidate onboarding</p>} />
          <Route element={<GuestGuard allowedRoles={['candidate']} />}>
            <Route path="/sign-up" element={<p>Sign-up page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Candidate onboarding')).toBeInTheDocument()
  })

  it('does not block another portal role from its own login page', () => {
    useSession.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      user: { role: 'candidate', job_preferences_configured: true },
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/login']}>
        <Routes>
          <Route element={<GuestGuard allowedRoles={['employer']} />}>
            <Route path="/tuyendung/app/login" element={<p>Employer login</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer login')).toBeInTheDocument()
  })
})
