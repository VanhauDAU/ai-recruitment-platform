import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import CandidateSearchWorkspace from './CandidateSearchWorkspace'

const api = vi.hoisted(() => ({
  searchCandidates: vi.fn(),
  inviteSearchCandidate: vi.fn(),
  getEmployerJobPage: vi.fn(),
}))
vi.mock('../api/candidate-search.api', async (importOriginal) => ({
  ...(await importOriginal()),
  searchCandidates: api.searchCandidates,
  inviteSearchCandidate: api.inviteSearchCandidate,
}))
vi.mock('@/entities/job/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getEmployerJobPage: api.getEmployerJobPage,
  getJobCategories: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/entities/system/location', async (importOriginal) => ({
  ...(await importOriginal()),
  getProvinces: vi.fn().mockResolvedValue([]),
}))

const candidate = (overrides) => ({
  ref: 'r1',
  code: 'UV-AB12CD',
  score: 82,
  level: 'very_high',
  title: 'Lập trình viên PHP',
  experience_months: 26,
  education_level: 'university',
  position_level: 'employee',
  languages: [{ code: 'en', level: 'working' }],
  matched_skills: ['Laravel'],
  matched_skill_count: 1,
  job_skill_count: 3,
  experience: [
    { title: 'Lập trình viên PHP', start: '2024-06', end: null },
    { title: 'Thực tập sinh', start: '2023-01', end: '2023-06' },
  ],
  experience_count: 4,
  education: [{ title: 'Cử nhân CNTT', subtitle: 'Đại học Duy Tân' }],
  desired_positions: ['Lập trình viên Backend'],
  provinces: ['Đà Nẵng'],
  cv_updated_at: new Date().toISOString(),
  applied: false,
  invited: false,
  invitation_status: null,
  ...overrides,
})

describe('CandidateSearchWorkspace', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getEmployerJobPage.mockResolvedValue({ count: 1, results: [{ public_id: 'jb_1', title: 'PHP Developer' }] })
    api.searchCandidates.mockResolvedValue({
      count: 2,
      page_size: 20,
      results: [candidate(), candidate({ ref: 'r2', code: 'UV-ZZ99', applied: true, experience_months: 0, experience: [], experience_count: 0, education: [], desired_positions: [], provinces: [], languages: [] })],
    })
    api.inviteSearchCandidate.mockResolvedValue()
  })

  it('shows the anonymous career card and invites the selected candidates', async () => {
    const user = userEvent.setup()
    render(withQueryClient(<CandidateSearchWorkspace jobPublicId="jb_1" onJobChange={vi.fn()} />))

    expect(await screen.findByText('UV-AB12CD')).toBeInTheDocument()
    expect(screen.getByText('Kinh nghiệm (2 năm 2 tháng)')).toBeInTheDocument()
    expect(screen.getByText('06/2024 – nay')).toBeInTheDocument()
    expect(screen.getByText('Cử nhân CNTT – Đại học Duy Tân')).toBeInTheDocument()
    expect(screen.getByText('Muốn làm: Lập trình viên Backend')).toBeInTheDocument()
    expect(screen.getByText('Xem thêm 2 công việc')).toBeInTheDocument()
    expect(screen.getByText('2 CV phù hợp')).toBeInTheDocument()

    // Ứng viên đã ứng tuyển không chọn được; "Chọn tất cả" chỉ lấy người mời được.
    await user.click(screen.getByLabelText('Chọn tất cả'))
    expect(screen.getByText('Đã chọn 1')).toBeInTheDocument()
    await user.click(screen.getByText('Mời kết nối').closest('button'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByText('Mời kết nối').closest('button'))

    await waitFor(() => expect(api.inviteSearchCandidate).toHaveBeenCalledWith('r1', 'jb_1'))
    expect(api.inviteSearchCandidate).toHaveBeenCalledTimes(1)
  })

  it('applies the filter form only when the search is submitted', async () => {
    const user = userEvent.setup()
    render(withQueryClient(<CandidateSearchWorkspace jobPublicId="jb_1" onJobChange={vi.fn()} />))
    await screen.findByText('UV-AB12CD')

    await user.click(screen.getByText('Bộ lọc').closest('button'))
    await user.type(await screen.findByLabelText('Từ khóa cần tìm'), 'Laravel')
    expect(api.searchCandidates).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText('Tìm CV').closest('button'))

    await waitFor(() => expect(api.searchCandidates).toHaveBeenLastCalledWith(
      expect.objectContaining({ job: 'jb_1', q: 'Laravel', page: 1, page_size: 20 }),
    ))
  })
})
