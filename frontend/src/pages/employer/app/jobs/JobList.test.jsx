import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobList from './JobList'

const mocks = vi.hoisted(() => ({
  closeEmployerJob: vi.fn(),
  deleteEmployerJob: vi.fn(),
  duplicateEmployerJob: vi.fn(),
  getEmployerJobPage: vi.fn(),
  readinessState: { canAccessCandidateData: true },
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/job', () => ({
  EMPLOYMENT_TYPE_LABELS: { full_time: 'Toàn thời gian' },
  closeEmployerJob: mocks.closeEmployerJob,
  deleteEmployerJob: mocks.deleteEmployerJob,
  duplicateEmployerJob: mocks.duplicateEmployerJob,
  formatDeadline: () => 'Còn 12 ngày',
  formatLocations: (job) => job.locations_detail?.[0]?.name || null,
  getEmployerJobPage: mocks.getEmployerJobPage,
  jobKeys: {
    employerList: (params = {}) => ['jobs', 'employer-list', params],
  },
}))

vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))
vi.mock('@/entities/employer-profile', async (importOriginal) => ({
  ...await importOriginal(),
  useEmployerReadiness: () => mocks.readinessState,
}))

const ACTIVE_JOB = {
  public_id: 'job_active',
  title: 'Kỹ sư Frontend',
  status: 'active',
  campaign: 'camp_growth',
  campaign_name: 'Đội sản phẩm Growth',
  deadline: '2026-08-30',
  employment_type: 'full_time',
  locations_detail: [{ name: 'Đà Nẵng' }],
  application_count: 5,
  candidate_count: 3,
  candidate_previews: [
    {
      application_public_id: 'app_anna',
      public_id: 'candidate_anna',
      full_name: 'Nguyễn Minh Anh',
      avatar_url: 'https://cdn.example.com/anna.jpg',
      cv_title: 'CV Frontend chính',
    },
    {
      application_public_id: 'app_nam',
      public_id: 'candidate_nam',
      full_name: 'Trần Hải Nam',
      avatar_url: '',
      cv_title: 'CV React',
    },
  ],
  view_count: 128,
}

const DRAFT_JOB = {
  public_id: 'job_draft',
  title: 'Backend Developer',
  status: 'draft',
  deadline: null,
  employment_type: 'full_time',
  locations_detail: [],
  application_count: 0,
  candidate_count: 0,
  candidate_previews: [],
  view_count: 0,
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-search">{location.search}</output>
}

function renderPage(initialEntry = '/tuyendung/app/jobs') {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false },
    },
  })
  const rendered = render(
    <ConfigProvider theme={{ token: { motion: false } }} wave={{ disabled: true }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <JobList />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  )
  return { ...rendered, queryClient }
}

describe('JobList', () => {
  beforeEach(() => {
    mocks.readinessState.canAccessCandidateData = true
    mocks.getEmployerJobPage.mockReset().mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [ACTIVE_JOB, DRAFT_JOB],
    })
    mocks.closeEmployerJob.mockReset().mockResolvedValue({
      ...ACTIVE_JOB,
      status: 'closed',
    })
    mocks.deleteEmployerJob.mockReset().mockResolvedValue(DRAFT_JOB.public_id)
    mocks.duplicateEmployerJob.mockReset().mockResolvedValue({
      ...ACTIVE_JOB,
      public_id: 'job_copy',
      status: 'draft',
    })
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
  })

  it('redacts cached candidate identity and application links after access is revoked', async () => {
    const page = renderPage()
    const activeCard = await screen.findByTestId('job-list-item-job_active')
    expect(within(activeCard).getByRole('link', { name: 'Mở hồ sơ Nguyễn Minh Anh' }))
      .toBeInTheDocument()

    mocks.readinessState.canAccessCandidateData = false
    page.rerender(
      <ConfigProvider theme={{ token: { motion: false } }} wave={{ disabled: true }}>
        <QueryClientProvider client={page.queryClient}>
          <MemoryRouter initialEntries={['/tuyendung/app/jobs']}>
            <JobList />
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>,
    )

    expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Mở hồ sơ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Xem hồ sơ ứng tuyển' })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('job-list-item-job_active')).getByText('3 ứng viên'))
      .toBeInTheDocument()
  })

  it('renders each job as a compact data row with status, deadline and grouped candidate avatars', async () => {
    renderPage()

    const createJobLinks = await screen.findAllByRole('link', { name: 'Đăng tin tuyển dụng' })
    expect(createJobLinks).toHaveLength(2)
    createJobLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/tuyendung/app/jobs/new')
    })
    const activeCard = await screen.findByTestId('job-list-item-job_active')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(activeCard).getByRole('link', { name: 'Kỹ sư Frontend' })).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/job_active',
    )
    expect(within(activeCard).getByText('Đang tuyển')).toBeInTheDocument()
    expect(within(activeCard).getByText('Đội sản phẩm Growth')).toBeInTheDocument()
    expect(within(activeCard).getByText(/Đà Nẵng/)).toBeInTheDocument()
    expect(within(activeCard).getByText(/30\/08\/2026/)).toBeInTheDocument()
    expect(within(activeCard).getByText(/Còn 12 ngày/)).toBeInTheDocument()
    expect(within(activeCard).getByText('128')).toBeInTheDocument()

    const annaLink = within(activeCard).getByRole('link', { name: 'Mở hồ sơ Nguyễn Minh Anh' })
    expect(annaLink).toHaveAttribute(
      'href',
      '/tuyendung/app/applications?job=job_active&application=app_anna',
    )
    expect(annaLink.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/anna.jpg',
    )
    expect(within(activeCard).getByRole('link', { name: 'Mở hồ sơ Trần Hải Nam' }))
      .toHaveTextContent('HN')

    const candidateSummary = within(activeCard).getByRole('link', {
      name: /3 ứng viên.*5 CV/,
    })
    expect(candidateSummary).toHaveAttribute(
      'href',
      '/tuyendung/app/applications?job=job_active',
    )

    const draftCard = screen.getByTestId('job-list-item-job_draft')
    expect(within(draftCard).getByText('Nháp')).toBeInTheDocument()
    expect(within(draftCard).getByText('Chưa có hồ sơ')).toBeInTheDocument()
    expect(within(draftCard).getAllByRole('link', { name: 'Hoàn thiện' })[0]).toHaveAttribute(
      'href',
      '/tuyendung/app/jobs/job_draft/edit',
    )
  })

  it('keeps quick actions hover-revealed and exposes the full status-aware menu', async () => {
    const user = userEvent.setup()
    renderPage()

    const activeCard = await screen.findByTestId('job-list-item-job_active')
    const activeHoverActions = within(activeCard).getByTestId('job-hover-actions')
    expect(activeHoverActions).toHaveClass('opacity-0')
    expect(activeHoverActions.className).toContain('group-hover:opacity-100')
    expect(within(activeCard).getAllByRole('link', { name: 'Xem hồ sơ ứng tuyển' })).not.toHaveLength(0)
    expect(within(activeCard).getAllByRole('link', { name: 'Chỉnh sửa tin' })).not.toHaveLength(0)
    await user.click(within(activeCard).getByRole('button', {
      name: 'Mở thao tác cho Kỹ sư Frontend',
    }))
    expect(await screen.findByRole('menuitem', { name: /Sao chép thành bản nháp/ }))
      .toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /Đóng tin/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    const draftCard = screen.getByTestId('job-list-item-job_draft')
    await user.click(within(draftCard).getByRole('button', {
      name: 'Mở thao tác cho Backend Developer',
    }))
    expect(await screen.findByRole('menuitem', { name: /Xóa bản nháp/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /Xóa bản nháp/ })).not.toBeInTheDocument()
    })
  })

  it('derives the API query from URL filters and removes the old page when status changes', async () => {
    const user = userEvent.setup()
    renderPage('/tuyendung/app/jobs?status=active&q=frontend&page=3')

    await waitFor(() => expect(mocks.getEmployerJobPage).toHaveBeenCalledWith({
      page: 3,
      q: 'frontend',
      status: 'active',
    }))

    await user.click(screen.getByRole('combobox', { name: 'Lọc trạng thái tin tuyển dụng' }))
    await user.click(await screen.findByText('Nháp', {
      selector: '.ant-select-item-option-content',
    }))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location-search').textContent)
      expect(params.get('status')).toBe('draft')
      expect(params.get('q')).toBe('frontend')
      expect(params.has('page')).toBe(false)
    })
    await waitFor(() => expect(mocks.getEmployerJobPage).toHaveBeenLastCalledWith({
      page: 1,
      q: 'frontend',
      status: 'draft',
    }))
  })

  it('runs row mutations for duplicate, close and draft deletion with the matching public id', async () => {
    const user = userEvent.setup()
    renderPage()

    const activeCard = await screen.findByTestId('job-list-item-job_active')
    await user.click(within(activeCard).getByRole('button', {
      name: 'Mở thao tác cho Kỹ sư Frontend',
    }))
    await user.click(await screen.findByRole('menuitem', {
      name: /Sao chép thành bản nháp/,
    }))
    await waitFor(() => expect(mocks.duplicateEmployerJob).toHaveBeenCalledWith(
      'job_active',
      expect.any(Object),
    ))
    expect(mocks.message.success).toHaveBeenCalledWith('Đã tạo bản nháp sao chép.')
    await waitFor(() => expect(mocks.getEmployerJobPage).toHaveBeenCalledTimes(2))

    const refreshedActiveCard = screen.getByTestId('job-list-item-job_active')
    await user.click(within(refreshedActiveCard).getByRole('button', {
      name: 'Mở thao tác cho Kỹ sư Frontend',
    }))
    await user.click(await screen.findByRole('menuitem', { name: /Đóng tin/ }))
    const closeDialog = await screen.findByRole('dialog')
    expect(within(closeDialog).getByRole('heading', { name: 'Đóng tin tuyển dụng' }))
      .toBeInTheDocument()
    expect(within(closeDialog).getByText('Kỹ sư Frontend')).toBeInTheDocument()
    expect(closeDialog).toHaveTextContent('Tin sẽ ngừng hiển thị với ứng viên.')
    await user.click(within(closeDialog).getByRole('button', { name: 'Đóng tin' }))
    await waitFor(() => expect(mocks.closeEmployerJob).toHaveBeenCalledWith(
      'job_active',
      expect.any(Object),
    ))
    expect(mocks.message.success).toHaveBeenCalledWith('Đã đóng tin tuyển dụng.')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    const draftCard = screen.getByTestId('job-list-item-job_draft')
    await user.click(within(draftCard).getByRole('button', {
      name: 'Mở thao tác cho Backend Developer',
    }))
    await user.click(await screen.findByRole('menuitem', { name: /Xóa bản nháp/ }))
    const deleteDialog = await screen.findByRole('dialog')
    expect(within(deleteDialog).getByRole('heading', { name: 'Xóa bản nháp' }))
      .toBeInTheDocument()
    expect(within(deleteDialog).getByText('Backend Developer')).toBeInTheDocument()
    expect(within(deleteDialog).getByText(/không thể hoàn tác/)).toBeInTheDocument()
    await user.click(within(deleteDialog).getByRole('button', { name: 'Xóa bản nháp' }))
    await waitFor(() => expect(mocks.deleteEmployerJob).toHaveBeenCalledWith(
      'job_draft',
      expect.any(Object),
    ))
    expect(mocks.message.success).toHaveBeenCalledWith('Đã xóa bản nháp.')
  })

  it('uses a clear fallback name when confirming deletion of an untitled draft', async () => {
    const user = userEvent.setup()
    mocks.getEmployerJobPage.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...DRAFT_JOB, title: '' }],
    })
    renderPage()

    const draftCard = await screen.findByTestId('job-list-item-job_draft')
    await user.click(within(draftCard).getByRole('button', {
      name: 'Mở thao tác cho Tin nháp chưa đặt tên',
    }))
    await user.click(await screen.findByRole('menuitem', { name: /Xóa bản nháp/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Xóa bản nháp' })).toBeInTheDocument()
    expect(within(dialog).getByText('Tin nháp chưa đặt tên')).toBeInTheDocument()
  })
})
