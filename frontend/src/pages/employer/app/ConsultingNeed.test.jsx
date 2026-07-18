import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerConsultingNeed from './ConsultingNeed'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/widgets/employer-consulting-need', () => ({ EmployerConsultingNeedPanel: () => <p>Khai báo nhu cầu</p> }))

describe('EmployerConsultingNeed', () => {
  beforeEach(() => useSession.mockReset())

  it('does not let a completed employer reopen the consulting form', () => {
    useSession.mockReturnValue({ user: { employer_onboarding_step: 'complete' } })

    render(
      <MemoryRouter initialEntries={['/tuyendung/app/consulting-need']}>
        <Routes>
          <Route path="/tuyendung/app/consulting-need" element={<EmployerConsultingNeed />} />
          <Route path="/tuyendung/app/dashboard" element={<p>Employer dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Employer dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Khai báo nhu cầu')).not.toBeInTheDocument()
  })

  it('keeps the form available only during the consulting step', () => {
    useSession.mockReturnValue({ user: { employer_onboarding_step: 'consulting_need' } })

    render(
      <MemoryRouter>
        <EmployerConsultingNeed />
      </MemoryRouter>,
    )

    expect(screen.getByText('Khai báo nhu cầu')).toBeInTheDocument()
  })
})
