import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerOnboardingGuard from './EmployerOnboardingGuard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))

describe('EmployerOnboardingGuard', () => {
  beforeEach(() => useSession.mockReset())

  it('redirects an incomplete employer to onboarding', () => {
    useSession.mockReturnValue({ user: { role: 'employer', employer_onboarding_required: true, employer_onboarding_step: 'email_verification' } })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route path="/tuyendung/app/account/verify" element={<p>Employer onboarding</p>} />
          <Route element={<EmployerOnboardingGuard />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Employer dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer onboarding')).toBeInTheDocument()
    expect(screen.queryByText('Employer dashboard')).not.toBeInTheDocument()
  })

  it('renders the workspace for an account-ready employer', () => {
    useSession.mockReturnValue({ user: { role: 'employer', employer_onboarding_required: false } })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/dashboard']}>
        <Routes>
          <Route element={<EmployerOnboardingGuard />}>
            <Route path="/tuyendung/app/dashboard" element={<p>Employer dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer dashboard')).toBeInTheDocument()
  })
})
