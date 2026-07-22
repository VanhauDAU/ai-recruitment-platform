import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerApplicationList from './ApplicationList'

const mocks = vi.hoisted(() => ({
  getRecruiterApplications: vi.fn(),
  getRecruiterApplicationSnapshot: vi.fn(),
  getApplicationHistory: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

vi.mock('@/entities/application', () => ({
  applicationKeys: {
    recruiterList: (params) => ['applications', 'recruiter-list', params],
    recruiterSnapshot: (publicId) => ['applications', 'snapshot', publicId],
    history: (publicId) => ['applications', 'history', publicId],
  },
  getRecruiterApplications: mocks.getRecruiterApplications,
  getRecruiterApplicationSnapshot: mocks.getRecruiterApplicationSnapshot,
  getApplicationHistory: mocks.getApplicationHistory,
  updateApplicationStatus: mocks.updateApplicationStatus,
  RECRUITER_APPLICATION_STATUSES: [['submitted', 'Tiếp nhận'], ['accepted', 'Đã nhận offer']],
  RECRUITER_APPLICATION_STATUS_LABELS: { submitted: 'Tiếp nhận', accepted: 'Đã nhận offer' },
}))

vi.mock('@/entities/cv', () => ({ CvDocumentPreview: () => <div>CV preview</div> }))

const APPLICATION = {
  public_id: 'app_1',
  candidate_name: 'Nguyễn An',
  candidate_email: 'an@example.com',
  job_title: 'Kỹ sư Frontend',
  applied_at: '2026-07-22T08:00:00+07:00',
  status: 'accepted',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyendung/app/applications?campaign=camp_1&application=app_1']}>
        <EmployerApplicationList />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerApplicationList', () => {
  beforeEach(() => {
    mocks.getRecruiterApplications.mockReset().mockResolvedValue([APPLICATION])
    mocks.getRecruiterApplicationSnapshot.mockReset().mockResolvedValue({
      ...APPLICATION,
      submitted_cv_title: 'CV Frontend',
      contact_email: 'an@example.com',
      contact_phone: '0900000000',
    })
    mocks.getApplicationHistory.mockReset().mockResolvedValue([])
    mocks.updateApplicationStatus.mockReset()
  })

  it('opens the requested CV detail and exposes status changes only there', async () => {
    renderPage()

    const detail = await screen.findByRole('dialog')
    expect(await within(detail).findByLabelText('Cập nhật trạng thái hồ sơ')).toBeInTheDocument()
    expect(screen.getAllByText('Đã nhận offer').length).toBeGreaterThan(0)
  })
})
