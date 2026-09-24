import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerVerificationPanel from './EmployerVerificationPanel'

const mocks = vi.hoisted(() => ({
  getEmployerRecruitmentNeed: vi.fn(),
  readinessState: {
    profile: { onboarding: {} },
    profileQuery: { refetch: vi.fn() },
    readiness: { candidateDataAccess: true, blockers: [] },
    isAccessError: false,
    isChecking: true,
    canAccessCandidateData: false,
  },
}))

vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  getEmployerRecruitmentNeed: mocks.getEmployerRecruitmentNeed,
  useEmployerReadiness: () => mocks.readinessState,
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({ user: { full_name: 'Nguyễn An', email: 'hr@example.com' } }),
}))
vi.mock('@/features/verify-employer-account', () => ({
  EmployerVerificationChecklist: () => <p>Checklist xác thực</p>,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tuyendung/app/employer-verify']}>
        <Routes>
          <Route path="/tuyendung/app/employer-verify" element={<EmployerVerificationPanel />} />
          <Route path="/tuyendung/app/dashboard" element={<p>Dashboard đã mở</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerVerificationPanel readiness navigation', () => {
  beforeEach(() => {
    mocks.getEmployerRecruitmentNeed.mockReset().mockResolvedValue(null)
    mocks.readinessState.isAccessError = false
    mocks.readinessState.isChecking = true
    mocks.readinessState.canAccessCandidateData = false
    mocks.readinessState.readiness.candidateDataAccess = true
  })

  it('does not redirect from cached true readiness while a refetch is checking access', () => {
    renderPage()

    expect(screen.getByText('Checklist xác thực')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard đã mở')).not.toBeInTheDocument()
  })

  it('redirects only after the canonical candidate-data check is ready and allowed', () => {
    mocks.readinessState.isChecking = false
    mocks.readinessState.canAccessCandidateData = true
    renderPage()

    expect(screen.getByText('Dashboard đã mở')).toBeInTheDocument()
    expect(screen.queryByText('Checklist xác thực')).not.toBeInTheDocument()
  })
})
