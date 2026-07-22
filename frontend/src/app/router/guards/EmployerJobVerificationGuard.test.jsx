import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerJobVerificationGuard from './EmployerJobVerificationGuard'

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }))

vi.mock('@tanstack/react-query', () => ({ useQuery }))
vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile: vi.fn() }))

describe('EmployerJobVerificationGuard', () => {
  beforeEach(() => useQuery.mockReset())

  it('redirects an employer with incomplete verification to the checklist', () => {
    useQuery.mockReturnValue({
      data: { onboarding: { verification_completed: false } },
      isLoading: false,
      isError: false,
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/jobs']}>
        <Routes>
          <Route path="/tuyendung/app/employer-verify" element={<p>Employer verification</p>} />
          <Route element={<EmployerJobVerificationGuard />}>
            <Route path="/tuyendung/app/jobs" element={<p>Employer jobs</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer verification')).toBeInTheDocument()
    expect(screen.queryByText('Employer jobs')).not.toBeInTheDocument()
  })

  it('renders a job page after all five verification steps are complete', () => {
    useQuery.mockReturnValue({
      data: { onboarding: { verification_completed: true } },
      isLoading: false,
      isError: false,
    })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/jobs']}>
        <Routes>
          <Route element={<EmployerJobVerificationGuard />}>
            <Route path="/tuyendung/app/jobs" element={<p>Employer jobs</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer jobs')).toBeInTheDocument()
  })
})
