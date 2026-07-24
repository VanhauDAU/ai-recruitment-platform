import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminConsultationLeads from './ConsultationLeads'

const {
  getAdminConsultationLeads,
  message,
  updateAdminConsultationLead,
} = vi.hoisted(() => ({
  getAdminConsultationLeads: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  updateAdminConsultationLead: vi.fn(),
}))

vi.mock('@/entities/consultation-lead', () => ({
  consultationLeadKeys: {
    all: ['consultation-leads'],
    adminLists: ['consultation-leads', 'admin', 'list'],
    adminList: ({ status = '', page = 1 } = {}) => [
      'consultation-leads',
      'admin',
      'list',
      { status, page },
    ],
  },
  getAdminConsultationLeads,
  updateAdminConsultationLead,
}))

vi.mock('@/shared/lib/toast', () => ({ message }))

function lead(id, overrides = {}) {
  return {
    id,
    full_name: `Lead ${id}`,
    company_name: 'ProCV',
    email: `lead-${id}@example.com`,
    phone: '0900000000',
    province: 'Hà Nội',
    need_label: 'Đăng tin',
    note: '',
    source_page: '/employer',
    status: 'new',
    created_at: '2026-07-24T08:00:00Z',
    ...overrides,
  }
}

function renderPage({ retry = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry, retryDelay: 0 },
    },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminConsultationLeads />
      </QueryClientProvider>,
    ),
  }
}

async function chooseStatus(user, label) {
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByText(label, {
    selector: '.ant-select-item-option-content',
  }))
}

describe('AdminConsultationLeads', () => {
  beforeEach(() => {
    getAdminConsultationLeads.mockReset()
    updateAdminConsultationLead.mockReset()
    message.error.mockReset()
    message.success.mockReset()
  })

  it('keys requests by server page/filter and resets the page when the filter changes', async () => {
    getAdminConsultationLeads.mockImplementation(async ({ page, status }) => ({
      count: status === 'new' ? 45 : 1,
      results: [lead(`${status || 'all'}-${page}`, { status: status || 'contacted' })],
    }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Lead new-1')).toBeInTheDocument()
    await user.click(screen.getByTitle('2'))
    expect(await screen.findByText('Lead new-2')).toBeInTheDocument()

    await chooseStatus(user, 'Đã liên hệ')
    expect(await screen.findByText('Lead contacted-1')).toBeInTheDocument()

    expect(getAdminConsultationLeads).toHaveBeenCalledWith(
      { status: 'new', page: 2 },
      { signal: expect.any(AbortSignal) },
    )
    expect(getAdminConsultationLeads).toHaveBeenLastCalledWith(
      { status: 'contacted', page: 1 },
      { signal: expect.any(AbortSignal) },
    )
  })

  it('aborts an obsolete filter request and ignores its late response', async () => {
    const pending = []
    getAdminConsultationLeads.mockImplementation((params, { signal }) => (
      new Promise((resolve) => pending.push({ params, resolve, signal }))
    ))
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(pending).toHaveLength(1))

    await chooseStatus(user, 'Đã liên hệ')
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[0].signal.aborted).toBe(true)

    await act(async () => {
      pending[1].resolve({
        count: 1,
        results: [lead('fresh', { full_name: 'Lead mới', status: 'contacted' })],
      })
    })
    expect(await screen.findByText('Lead mới')).toBeInTheDocument()

    await act(async () => {
      pending[0].resolve({
        count: 1,
        results: [lead('stale', { full_name: 'Lead cũ' })],
      })
    })
    expect(screen.queryByText('Lead cũ')).not.toBeInTheDocument()
  })

  it('invalidates the canonical list after marking one row as contacted', async () => {
    getAdminConsultationLeads.mockResolvedValue({
      count: 1,
      results: [lead(7)],
    })
    updateAdminConsultationLead.mockResolvedValue({ id: 7, status: 'contacted' })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Lead 7')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đã liên hệ' }))

    await waitFor(() => expect(updateAdminConsultationLead).toHaveBeenCalledWith(
      7,
      { status: 'contacted' },
    ))
    await waitFor(() => expect(getAdminConsultationLeads).toHaveBeenCalledTimes(2))
    expect(message.success).toHaveBeenCalledWith('Đã đánh dấu lead là đã liên hệ.')
  })

  it('moves back before refetching when the only lead on the last new page is removed', async () => {
    let contacted = false
    getAdminConsultationLeads.mockImplementation(async ({ page }) => {
      if (page === 1) {
        return {
          count: contacted ? 20 : 21,
          results: [lead(1)],
        }
      }
      if (page === 2 && !contacted) {
        return {
          count: 21,
          results: [lead(21)],
        }
      }
      throw new Error('page out of range')
    })
    updateAdminConsultationLead.mockImplementation(async () => {
      contacted = true
      return { id: 21, status: 'contacted' }
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Lead 1')).toBeInTheDocument()
    await user.click(screen.getByTitle('2'))
    expect(await screen.findByText('Lead 21')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đã liên hệ' }))

    await waitFor(() => {
      const pageOneCalls = getAdminConsultationLeads.mock.calls
        .filter(([params]) => params.page === 1)
      expect(pageOneCalls).toHaveLength(2)
    })
    expect(
      getAdminConsultationLeads.mock.calls.filter(([params]) => params.page === 2),
    ).toHaveLength(1)
    expect(await screen.findByText('Lead 1')).toBeInTheDocument()
    expect(message.error).not.toHaveBeenCalled()
  })

  it('uses the provider retry policy before showing the final load error', async () => {
    getAdminConsultationLeads.mockRejectedValue(new Error('network unavailable'))
    renderPage({ retry: 1 })

    await waitFor(() => expect(getAdminConsultationLeads).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(message.error).toHaveBeenCalledWith(
      'Không thể tải danh sách yêu cầu tư vấn.',
    ))
  })
})
