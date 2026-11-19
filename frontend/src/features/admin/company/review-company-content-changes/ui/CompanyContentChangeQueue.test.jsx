import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findTableRow, getButtonByText } from '@/test/antd-queries'
import CompanyContentChangeQueue from './CompanyContentChangeQueue'

const { api, toast } = vi.hoisted(() => ({
  api: {
    getAdminCompanyContentChanges: vi.fn(),
    markAdminCompanyContentChangesReviewed: vi.fn(),
    revertAdminCompanyContentChange: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/entities/company/admin-company', async (importOriginal) => ({ ...await importOriginal(), ...api }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const CHANGE = {
  public_id: 'cch_1',
  status: 'unreviewed',
  status_label: 'Chưa xem',
  company: { public_id: 'co_alpha', name: 'Alpha Tech', public_path: '/cong-ty/alpha', content_review_required: false },
  actor_email: 'owner@alpha.vn',
  sections: ['hero'],
  changed_fields: [
    { field: 'headline', label: 'Khẩu hiệu', kind: 'text', before: '', after: 'Số 1 Việt Nam' },
    { field: 'culture', label: 'Văn hoá', kind: 'html', before: null, after: '<p>Minh bạch</p><script>x()</script>' },
  ],
  created_at: '2026-11-19T03:00:00Z',
  reviewed_by_email: '',
  reviewed_at: null,
  review_note: '',
}

function renderQueue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CompanyContentChangeQueue />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompanyContentChangeQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdminCompanyContentChanges.mockResolvedValue({ count: 1, results: [CHANGE] })
  })

  it('lists unreviewed changes and shows the before/after of a row', async () => {
    renderQueue()
    const row = await findTableRow('cch_1')

    expect(api.getAdminCompanyContentChanges).toHaveBeenCalledWith({ page: 1, status: 'unreviewed' }, expect.anything())
    expect(within(row).getByText('Alpha Tech')).toBeInTheDocument()
    expect(within(row).getByText('Đầu trang')).toBeInTheDocument()
    fireEvent.click(row.querySelector('.ant-table-row-expand-icon'))
    expect(await screen.findByText('Số 1 Việt Nam')).toBeInTheDocument()
    expect(screen.getByText('Minh bạch')).toBeInTheDocument()
    expect(document.querySelector('.content-change-diff script')).toBeNull()
  })

  it('marks a row reviewed', async () => {
    api.markAdminCompanyContentChangesReviewed.mockResolvedValue({ count: 1 })
    renderQueue()
    const row = await findTableRow('cch_1')

    fireEvent.click(getButtonByText(row, 'Đã xem'))

    await waitFor(() => expect(api.markAdminCompanyContentChangesReviewed).toHaveBeenCalledWith(['cch_1'], expect.anything()))
    expect(toast.success).toHaveBeenCalledWith('Đã đánh dấu 1 thay đổi là đã xem.')
  })

  it('reverts with a reason and can require review for the company', async () => {
    api.revertAdminCompanyContentChange.mockResolvedValue({ ...CHANGE, status: 'reverted' })
    renderQueue()
    const row = await findTableRow('cch_1')

    fireEvent.click(getButtonByText(row, 'Hoàn tác'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Lý do'), { target: { value: 'Khẩu hiệu sai sự thật về quy mô.' } })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(getButtonByText(dialog, 'Hoàn tác'))

    await waitFor(() => expect(api.revertAdminCompanyContentChange).toHaveBeenCalledWith('cch_1', {
      reason: 'Khẩu hiệu sai sự thật về quy mô.',
      requireReview: true,
    }))
    expect(toast.success).toHaveBeenCalledWith('Đã hoàn tác và thông báo cho nhà tuyển dụng.')
  })
})
