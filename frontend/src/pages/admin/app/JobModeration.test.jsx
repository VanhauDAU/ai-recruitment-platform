import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminJobModeration from './JobModeration'

const { getAdminJobModeration, reviewAdminJob } = vi.hoisted(() => ({
  getAdminJobModeration: vi.fn(),
  reviewAdminJob: vi.fn(),
}))

vi.mock('@/entities/job', () => ({
  getAdminJobModeration,
  jobKeys: { adminModeration: (params) => ['jobs', 'admin-moderation', params] },
  reviewAdminJob,
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminJobModeration />
    </QueryClientProvider>,
  )
}

describe('AdminJobModeration', () => {
  beforeEach(() => {
    getAdminJobModeration.mockReset()
    reviewAdminJob.mockReset()
    getAdminJobModeration.mockResolvedValue([
      {
        public_id: 'job_pending',
        title: 'Backend Engineer',
        company_name: 'Acme',
        employer_name: 'Nguyễn An',
        description: 'Mô tả công việc',
        deadline: '2026-08-30',
        status: 'pending',
        status_label: 'Chờ duyệt',
        submitted_at: '2026-07-22T09:00:00Z',
        rejected_reason: '',
      },
    ])
    reviewAdminJob.mockResolvedValue({ public_id: 'job_pending', status: 'active' })
  })

  it('lets an admin approve a pending job', async () => {
    renderPage()

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }))

    await waitFor(() => expect(reviewAdminJob).toHaveBeenCalledWith('job_pending', {
      action: 'approve',
    }))
  })

  it('requires and submits an employer-visible rejection reason', async () => {
    reviewAdminJob.mockResolvedValue({ public_id: 'job_pending', status: 'rejected' })
    renderPage()

    await screen.findByText('Backend Engineer')
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }))
    fireEvent.change(screen.getByLabelText('Lý do từ chối'), {
      target: { value: 'Vui lòng bổ sung quyền lợi.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lý do từ chối' }))

    await waitFor(() => expect(reviewAdminJob).toHaveBeenCalledWith('job_pending', {
      action: 'reject',
      reason: 'Vui lòng bổ sung quyền lợi.',
    }))
  })
})
