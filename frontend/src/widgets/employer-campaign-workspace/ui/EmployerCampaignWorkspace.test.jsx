import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerCampaignWorkspace from './EmployerCampaignWorkspace'

const mocks = vi.hoisted(() => ({
  activityPanel: vi.fn(),
  applyCvPanel: vi.fn(),
  getCampaign: vi.fn(),
  getCampaignReport: vi.fn(),
  readinessState: {
    readiness: {
      jobWorkspaceReady: true,
      verificationApproved: true,
      candidateDataAccess: false,
      dpaStatus: 'outdated',
      blockers: [{
        code: 'dpa_outdated',
        capabilities: ['candidate_data'],
        message: 'Chấp thuận DPA không còn là phiên bản hiện hành.',
        action: 'accept_current_dpa',
      }],
    },
    profileQuery: { refetch: vi.fn() },
    isChecking: false,
    isAccessError: false,
    canAccessCandidateData: false,
  },
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: {
    all: ['campaigns'],
    detail: (id) => ['campaigns', 'detail', id],
    report: (id) => ['campaigns', 'report', id],
  },
  getCampaign: mocks.getCampaign,
  getCampaignReport: mocks.getCampaignReport,
  updateCampaign: vi.fn(),
}))
vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => mocks.readinessState,
}))
vi.mock('@/features/manage-campaigns', () => ({
  CampaignNameForm: () => null,
}))
vi.mock('./CampaignApplyCvPanel', () => ({
  default: (props) => {
    mocks.applyCvPanel(props)
    return <p>Nguyễn Minh Anh</p>
  },
}))
vi.mock('./CampaignActivityPanel', () => ({
  default: (props) => {
    mocks.activityPanel(props)
    return <p>Nguyễn Minh Anh đã ứng tuyển</p>
  },
}))
vi.mock('./CampaignOverviewPanel', () => ({ default: () => <p>Tổng quan chiến dịch</p> }))
vi.mock('./CampaignJobsPanel', () => ({ default: () => <p>Tin tuyển dụng chiến dịch</p> }))
vi.mock('./CampaignWorkspaceHero', () => ({ default: ({ campaign }) => <h1>{campaign.name}</h1> }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="campaign-location">{location.pathname}{location.search}</output>
}

function renderPage(activeTab) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const initialEntry = `/tuyendung/app/campaigns/camp_1?active_tab=${activeTab}`
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <EmployerCampaignWorkspace publicId="camp_1" />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, initialEntry, queryClient }
}

describe('EmployerCampaignWorkspace candidate-data boundary', () => {
  beforeEach(() => {
    mocks.applyCvPanel.mockReset()
    mocks.activityPanel.mockReset()
    mocks.readinessState.canAccessCandidateData = false
    mocks.readinessState.isChecking = false
    mocks.readinessState.isAccessError = false
    mocks.readinessState.readiness.candidateDataAccess = false
    mocks.getCampaign.mockReset().mockResolvedValue({
      public_id: 'camp_1',
      name: 'Chiến dịch Frontend',
      status: 'active',
      application_count: 4,
      job_count: 2,
    })
    mocks.getCampaignReport.mockReset().mockResolvedValue({
      application_pair_count: 4,
      jobs: { total: 2 },
    })
  })

  it.each([
    ['apply_cv', 'applyCvPanel'],
    ['activity', 'activityPanel'],
  ])('keeps %s URL and makes zero sensitive panel calls when denied', async (tab, spyName) => {
    renderPage(tab)

    expect(await screen.findByRole('heading', { name: 'Chiến dịch Frontend' }))
      .toBeInTheDocument()
    expect(mocks[spyName]).not.toHaveBeenCalled()
    expect(screen.getByTestId('campaign-location')).toHaveTextContent(`active_tab=${tab}`)
    expect(screen.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeInTheDocument()
    expect(screen.queryByText(/Nguyễn Minh Anh/)).not.toBeInTheDocument()
  })

  it('does not mount either sensitive panel while readiness is in error', async () => {
    mocks.readinessState.isAccessError = true
    renderPage('apply_cv')

    expect(await screen.findByText('Không thể kiểm tra quyền truy cập')).toBeInTheDocument()
    expect(mocks.applyCvPanel).not.toHaveBeenCalled()
    expect(mocks.activityPanel).not.toHaveBeenCalled()
  })

  it('removes cached panel PII immediately when access changes from true to false', async () => {
    mocks.readinessState.canAccessCandidateData = true
    mocks.readinessState.readiness.candidateDataAccess = true
    const page = renderPage('apply_cv')

    expect(await screen.findByText('Nguyễn Minh Anh')).toBeInTheDocument()
    expect(mocks.applyCvPanel).toHaveBeenCalledTimes(1)

    mocks.readinessState.canAccessCandidateData = false
    mocks.readinessState.readiness.candidateDataAccess = false
    page.rerender(
      <QueryClientProvider client={page.queryClient}>
        <MemoryRouter initialEntries={[page.initialEntry]}>
          <EmployerCampaignWorkspace publicId="camp_1" />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument())
    expect(mocks.applyCvPanel).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Dữ liệu ứng viên đang được bảo vệ')).toBeInTheDocument()
  })
})
