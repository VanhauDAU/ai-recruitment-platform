import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobForm from './JobForm'

const mocks = vi.hoisted(() => ({
  getCampaignOptions: vi.fn(),
  getJobCategories: vi.fn(),
  getJobPostingContext: vi.fn(),
  publishEmployerJob: vi.fn(),
  saveEmployerJob: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: { all: ['campaigns'], options: ['campaigns', 'options'] },
  createCampaign: vi.fn(),
  getCampaignOptions: mocks.getCampaignOptions,
}))

vi.mock('@/entities/job', () => ({
  createSkill: vi.fn(),
  getEmployerJob: vi.fn(),
  getJobCategories: mocks.getJobCategories,
  getJobPostingContext: mocks.getJobPostingContext,
  jobKeys: {
    categories: ['jobs', 'categories'],
    employerDetail: (publicId) => ['jobs', 'employer-detail', publicId],
    postingContext: ['jobs', 'posting-context'],
    skills: ['jobs', 'skills'],
  },
  publishEmployerJob: mocks.publishEmployerJob,
  saveEmployerJob: mocks.saveEmployerJob,
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({
    user: {
      email: 'recruiter@example.com',
      full_name: 'Nguyễn Tuyển Dụng',
      phone: '0901234567',
    },
  }),
}))

vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

vi.mock('@/widgets/employer-job-editor', () => ({
  EmployerJobEditor: ({ defaultDeadlineDays, errorMessage, maxDeadlineDays, onPublish, onSaveDraft }) => (
    <div>
      {errorMessage && <p>{errorMessage}</p>}
      <p data-testid="deadline-policy">
        {defaultDeadlineDays}/{maxDeadlineDays}
      </p>
      <button type="button" onClick={() => onPublish({ title: 'Backend Engineer' }, null)}>
        Mô phỏng đăng tin
      </button>
      <button type="button" onClick={() => onSaveDraft({ title: 'Backend Engineer' }, null)}>
        Mô phỏng lưu nháp
      </button>
    </div>
  ),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyendung/app/jobs/new']}>
        <JobForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JobForm submission feedback', () => {
  beforeEach(() => {
    mocks.getCampaignOptions.mockReset().mockResolvedValue([])
    mocks.getJobCategories.mockReset().mockResolvedValue([])
    mocks.getJobPostingContext.mockReset().mockResolvedValue({ job_postable: true })
    mocks.publishEmployerJob.mockReset()
    mocks.saveEmployerJob.mockReset()
    mocks.message.error.mockReset()
    mocks.message.success.mockReset()
  })

  it('shows the backend error as a toast when publishing a job fails', async () => {
    mocks.publishEmployerJob.mockRejectedValue({
      response: {
        status: 400,
        data: { detail: 'Hạn nhận hồ sơ phải là một ngày trong tương lai.' },
      },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Mô phỏng đăng tin' }))

    await waitFor(() => expect(mocks.message.error).toHaveBeenCalledWith(
      'Hạn nhận hồ sơ phải là một ngày trong tương lai.',
      { duration: 5000, id: 'post-job-submit-error' },
    ))
    expect(await screen.findByText('Hạn nhận hồ sơ phải là một ngày trong tương lai.'))
      .toBeInTheDocument()
  })

  it('lists the blocking reasons when the employer may not publish yet', async () => {
    mocks.publishEmployerJob.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'JOB_PUBLICATION_BLOCKED',
          detail: 'Chưa thể đăng tin.',
          blocked_reasons: [
            { code: 'verification_required', label: 'Nhà tuyển dụng chưa được duyệt xác thực.' },
          ],
        },
      },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Mô phỏng đăng tin' }))

    await waitFor(() => expect(mocks.message.error).toHaveBeenCalledWith(
      'Chưa thể đăng tin. Nhà tuyển dụng chưa được duyệt xác thực.',
      { duration: 5000, id: 'post-job-submit-error' },
    ))
  })

  it('tells the employer the job is public as soon as it is published', async () => {
    mocks.publishEmployerJob.mockResolvedValue({ public_id: 'job_1', status: 'active' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Mô phỏng đăng tin' }))

    await waitFor(() => expect(mocks.message.success).toHaveBeenCalledWith(
      'Đã đăng tin. Ứng viên có thể xem tin ngay.',
    ))
  })

  it('uses the posting default as the suggestion and the maximum as the selectable limit', async () => {
    mocks.getJobPostingContext.mockResolvedValue({
      job_postable: true,
      default_deadline_days: 30,
      max_deadline_days: 90,
    })

    renderPage()

    expect(await screen.findByTestId('deadline-policy')).toHaveTextContent('30/90')
  })

  it('shows a toast when saving a draft fails', async () => {
    mocks.saveEmployerJob.mockRejectedValue({
      response: { status: 500, data: { detail: 'internal' } },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Mô phỏng lưu nháp' }))

    await waitFor(() => expect(mocks.message.error).toHaveBeenCalledWith(
      'Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.',
      { duration: 5000, id: 'post-job-draft-error' },
    ))
  })
})
