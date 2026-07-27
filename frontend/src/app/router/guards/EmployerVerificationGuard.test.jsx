import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerVerificationGuard from './EmployerVerificationGuard'

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }))

vi.mock('@tanstack/react-query', () => ({ useQuery }))

function renderGuard() {
  render(
    <MemoryRouter initialEntries={['/tuyendung/app/jobs']}>
      <Routes>
        <Route path="/tuyendung/app/employer-verify" element={<p>Verification checklist</p>} />
        <Route element={<EmployerVerificationGuard />}>
          <Route path="/tuyendung/app/jobs" element={<p>Employer jobs</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('EmployerVerificationGuard', () => {
  beforeEach(() => useQuery.mockReset())

  it('redirects an incomplete employer to verification', () => {
    useQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { onboarding: { verification_completed: false } },
    })

    renderGuard()

    expect(screen.getByText('Verification checklist')).toBeInTheDocument()
    expect(screen.queryByText('Employer jobs')).not.toBeInTheDocument()
  })

  it('renders protected resources after verification is complete', () => {
    useQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { onboarding: { verification_completed: true } },
    })

    renderGuard()

    expect(screen.getByText('Employer jobs')).toBeInTheDocument()
  })
})
