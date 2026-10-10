import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SavedJobRemarketingLane from './SavedJobRemarketingLane'

const mocks = vi.hoisted(() => ({
  consent: { marketing: true },
  consentStatus: 'ready',
  session: { isAuthenticated: true, user: { role: 'candidate' } },
  getLane: vi.fn(),
  recordImpression: vi.fn(),
}))

vi.mock('@/entities/consent', () => ({
  useConsent: () => ({ consent: mocks.consent, status: mocks.consentStatus }),
}))
vi.mock('@/entities/session', () => ({ useSession: () => mocks.session }))
vi.mock('@/entities/job', () => ({
  formatLocations: () => 'Hà Nội',
  formatSalary: () => '20 - 30 triệu',
  getSavedJobRemarketingLane: mocks.getLane,
  jobCardToneClass: () => 'bg-white',
  jobDetailPath: (job) => `/viec-lam/${job.slug}`,
  JobPresentationLabels: () => <span>Tài trợ</span>,
  recordSavedJobRemarketingImpression: mocks.recordImpression,
}))

function renderLane() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><SavedJobRemarketingLane /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SavedJobRemarketingLane', () => {
  beforeEach(() => {
    mocks.consent = { marketing: true }
    mocks.consentStatus = 'ready'
    mocks.session = { isAuthenticated: true, user: { role: 'candidate' } }
    mocks.getLane.mockReset().mockResolvedValue({
      status: 'ready',
      results: [{
        public_id: 'job_1',
        slug: 'backend-engineer',
        title: 'Backend Engineer',
        company_name: 'ProCV',
        display_reason: 'Bạn đã lưu tin này trước đây',
        remarketing_activation_public_id: 'jsa_1',
      }],
    })
    mocks.recordImpression.mockReset().mockResolvedValue({ counted: true })
    globalThis.IntersectionObserver = class {
      constructor(callback) { this.callback = callback }
      observe() { this.callback([{ isIntersecting: true, intersectionRatio: 0.8 }]) }
      disconnect() {}
    }
  })

  afterEach(() => { delete globalThis.IntersectionObserver })

  it('shows a disclosed reason and records only after the card enters view', async () => {
    renderLane()

    expect(await screen.findByText('Việc bạn đã quan tâm')).toBeInTheDocument()
    expect(screen.getByText('Tài trợ')).toBeInTheDocument()
    expect(screen.getByText('Bạn đã lưu tin này trước đây')).toBeInTheDocument()
    await waitFor(() => expect(mocks.recordImpression).toHaveBeenCalledWith({
      job_public_id: 'job_1',
      activation_public_id: 'jsa_1',
    }))
  })

  it('does not request or render the lane without marketing consent', () => {
    mocks.consent = { marketing: false }
    renderLane()

    expect(screen.queryByText('Việc bạn đã quan tâm')).not.toBeInTheDocument()
    expect(mocks.getLane).not.toHaveBeenCalled()
  })
})
