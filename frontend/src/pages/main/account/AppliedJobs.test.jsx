import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { getCandidateApplications } from '@/entities/application/application'
import { withQueryClient } from '@/test/render-with-query-client'
import AppliedJobs from './AppliedJobs'

vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  getCandidateApplications: vi.fn(),
}))
vi.mock('@/features/main/application/manage-candidate-application', () => ({
  CandidateApplicationActions: () => null,
}))

const application = (overrides) => ({
  public_id: 'app_1',
  job_title: 'Kỹ sư Backend',
  job_slug: 'ky-su-backend',
  company_name: 'ProCV Labs',
  applied_at: '2026-11-01T02:00:00Z',
  submitted_cv_title: 'CV Backend',
  status: 'viewed',
  is_current: true,
  timeline: [
    { status: 'viewed', label: 'Nhà tuyển dụng đã xem hồ sơ', occurred_at: '2026-11-02T02:00:00Z' },
    { status: 'submitted', label: 'Đã nộp hồ sơ', occurred_at: '2026-11-01T02:00:00Z' },
  ],
  ...overrides,
})

describe('AppliedJobs', () => {
  it('offers every status filter and marks stopped jobs', async () => {
    getCandidateApplications.mockResolvedValue([
      application({ job_stopped_at: '2026-11-10T07:04:00Z' }),
      application({ public_id: 'app_2', job_title: 'Kỹ sư Frontend', status: 'submitted', timeline: [] }),
      application({ public_id: 'app_old', is_current: false }),
    ])
    const user = userEvent.setup()
    render(withQueryClient(<MemoryRouter><AppliedJobs /></MemoryRouter>))

    const tabs = await screen.findByRole('tablist')
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Tất cả', 'Tiếp nhận', 'Đã xem', 'Phù hợp', 'Phỏng vấn', 'Trúng tuyển', 'Chưa phù hợp', 'Đã rút',
    ])
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByText('NTD ngừng tuyển vị trí này', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/ProCV sẽ thay bạn gửi/)).toBeInTheDocument()

    await user.click(within(tabs).getByRole('tab', { name: 'Tiếp nhận' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('Kỹ sư Frontend')).toBeInTheDocument()

    await user.click(within(tabs).getByRole('tab', { name: 'Trúng tuyển' }))
    expect(screen.getByText('Không có hồ sơ nào ở trạng thái này')).toBeInTheDocument()
  })

  it('shows six applications per page and returns to page 1 when the filter changes', async () => {
    getCandidateApplications.mockResolvedValue(Array.from({ length: 8 }, (_, index) => application({
      public_id: `app_${index}`,
      job_title: `Việc ${index + 1}`,
      status: index === 7 ? 'submitted' : 'viewed',
    })))
    const user = userEvent.setup()
    render(withQueryClient(<MemoryRouter initialEntries={['/tai-khoan/viec-lam-da-ung-tuyen?page=2']}><AppliedJobs /></MemoryRouter>))

    expect(await screen.findAllByRole('article')).toHaveLength(2)
    expect(screen.getByText('Việc 7')).toBeInTheDocument()

    await user.click(within(screen.getByTitle('1')).getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(6))
    expect(screen.getByText('Việc 1')).toBeInTheDocument()

    await user.click(within(screen.getByTitle('2')).getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    await user.click(screen.getByRole('tab', { name: 'Tiếp nhận' }))
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    expect(screen.queryByTitle('2')).not.toBeInTheDocument()
  })
})
