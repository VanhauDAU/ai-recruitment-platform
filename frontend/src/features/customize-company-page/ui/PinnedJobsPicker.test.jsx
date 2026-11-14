import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient, withQueryClient } from '@/test/render-with-query-client'
import PinnedJobsPicker from './PinnedJobsPicker'

const api = vi.hoisted(() => ({
  employerCompanyPageKeys: { pinnableJobs: (q) => ['employer', 'company', 'page', 'pinnable-jobs', { q }] },
  getEmployerPinnableJobs: vi.fn(),
}))

vi.mock('@/entities/employer-company-page', () => api)

const JOBS = [
  { public_id: 'jb_1', title: 'Kế toán trưởng', slug: 'ke-toan-truong', published_at: '2026-11-01T02:00:00Z' },
  { public_id: 'jb_2', title: 'Lập trình viên', slug: 'lap-trinh-vien', published_at: '2026-11-02T02:00:00Z' },
  { public_id: 'jb_3', title: 'Chuyên viên tuyển dụng', slug: 'chuyen-vien', published_at: null },
]

function renderPicker(props = {}) {
  const handlers = { onChange: vi.fn(), onPick: vi.fn() }
  render(withQueryClient(<PinnedJobsPicker jobs={JOBS.slice(0, 2)} max={3} {...handlers} {...props} />))
  return handlers
}

describe('PinnedJobsPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getEmployerPinnableJobs.mockResolvedValue(JOBS)
  })

  it('reorders and removes pinned jobs', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker()

    expect(screen.getByText(/Đã ghim 2\/3 tin/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chuyển Kế toán trưởng lên' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Chuyển Lập trình viên lên' }))
    expect(onChange).toHaveBeenLastCalledWith(['jb_2', 'jb_1'])

    await user.click(screen.getByRole('button', { name: 'Bỏ ghim Kế toán trưởng' }))
    expect(onChange).toHaveBeenLastCalledWith(['jb_2'])
  })

  it('searches only after the picker is opened and offers jobs that are not pinned yet', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker()
    expect(api.getEmployerPinnableJobs).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Thêm tin ghim' }))
    const results = await screen.findByRole('list', { name: 'Tin có thể ghim' })

    expect(api.getEmployerPinnableJobs.mock.calls[0][0]).toBe('')
    expect(within(results).getByRole('button', { name: 'Ghim Kế toán trưởng' })).toBeDisabled()
    await user.click(within(results).getByRole('button', { name: 'Ghim Chuyên viên tuyển dụng' }))
    expect(onPick).toHaveBeenCalledWith(JOBS[2])
  })

  it('stops offering more jobs once the registry limit is reached', async () => {
    const user = userEvent.setup()
    const client = createTestQueryClient()
    const picker = (jobs) => withQueryClient(<PinnedJobsPicker jobs={jobs} max={3} onChange={vi.fn()} onPick={vi.fn()} />, client)
    const { rerender } = render(picker(JOBS.slice(0, 2)))
    await user.click(screen.getByRole('button', { name: 'Thêm tin ghim' }))
    expect(await screen.findByRole('button', { name: 'Ghim Chuyên viên tuyển dụng' })).toBeEnabled()

    rerender(picker(JOBS))

    expect(screen.getByText(/Đã ghim tối đa 3 tin/)).toBeInTheDocument()
    within(screen.getByRole('list', { name: 'Tin có thể ghim' })).getAllByRole('button')
      .forEach((control) => expect(control).toBeDisabled())
  })

  it('disables adding when the limit is already reached', () => {
    renderPicker({ jobs: JOBS })
    expect(screen.getByRole('button', { name: 'Thêm tin ghim' })).toBeDisabled()
  })

  it('locks every action for a read-only viewer', () => {
    renderPicker({ disabled: true })
    screen.getAllByRole('button').forEach((control) => expect(control).toBeDisabled())
    expect(api.getEmployerPinnableJobs).not.toHaveBeenCalled()
  })
})
