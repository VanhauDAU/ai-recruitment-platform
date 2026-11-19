import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCompanyWorkspace from './AdminCompanyWorkspace'

const { companyApi, updateApi } = vi.hoisted(() => ({
  companyApi: {
    getAdminCompanies: vi.fn(),
    getAdminCompanySummary: vi.fn(),
  },
  updateApi: {
    getAdminCompanyUpdateRequests: vi.fn(),
  },
}))

vi.mock('@/entities/company/admin-company', async (importOriginal) => ({
  ...(await importOriginal()),
  ...companyApi,
}))
vi.mock('@/entities/company/admin-employer-verification', async (importOriginal) => ({
  ...(await importOriginal()),
  ...updateApi,
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderWorkspace({ initialEntry = '/admin/app/companies' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/app/companies" element={<AdminCompanyWorkspace />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminCompanyWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    companyApi.getAdminCompanies.mockResolvedValue({ count: 0, results: [] })
    companyApi.getAdminCompanySummary.mockResolvedValue({
      total: 0,
      pending_update_requests: 0,
      companies_without_single_owner: 0,
    })
    updateApi.getAdminCompanyUpdateRequests.mockResolvedValue({ count: 0, results: [] })
  })

  it('opens the requested company update tab with its company filter', async () => {
    renderWorkspace({ initialEntry: '/admin/app/companies?tab=updates&company=co_alpha' })

    expect(screen.getByRole('tab', { name: 'Yêu cầu cập nhật' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await waitFor(() => expect(updateApi.getAdminCompanyUpdateRequests).toHaveBeenCalledWith(
      {
        page: 1,
        status: 'submitted',
        company: 'co_alpha',
        ordering: '-updated_at',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(companyApi.getAdminCompanies).not.toHaveBeenCalled()
  })

  it('opens the update queue from the overview shortcut', async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole('button', {
      name: 'Yêu cầu cập nhật: 0. Mở hàng đợi xử lý',
    }))

    expect(screen.getByRole('tab', { name: 'Yêu cầu cập nhật' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await waitFor(() => expect(updateApi.getAdminCompanyUpdateRequests).toHaveBeenCalled())
  })

  it('shows enough context and a clear action for each pending update', async () => {
    // The pointer-events check walks computed styles of every ancestor of the
    // antd table cell, which costs seconds in jsdom and asserts nothing here.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    updateApi.getAdminCompanyUpdateRequests.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'cur_alpha',
        company: {
          public_id: 'co_alpha',
          name: 'Công ty Alpha',
          tax_code: '***4567',
        },
        requested_by_email: 'owner@example.com',
        requested_by_public_id: 'usr_owner',
        changes: {
          company_name: 'Tên mới',
          tax_code: '0123456789',
          website_url: 'https://alpha.example',
        },
        is_sensitive: true,
        documents: [{ public_id: 'doc_1' }],
        proof_type_label: 'Giấy đăng ký doanh nghiệp',
        updated_at: '2026-07-02T10:00:00Z',
        created_at: '2026-07-01T08:00:00Z',
      }],
    })
    renderWorkspace({ initialEntry: '/admin/app/companies?tab=updates' })

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getByText('Tên pháp lý')).toBeInTheDocument()
    expect(screen.getByText('Mã số thuế')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Thay đổi pháp lý')).toBeInTheDocument()
    expect(screen.getByText('1 tài liệu · Giấy đăng ký doanh nghiệp')).toBeInTheDocument()
    // Find the action by its text inside the request's row. A role query has
    // to resolve every candidate's computed style against antd's injected CSS,
    // which took over two seconds here in jsdom.
    const row = document.querySelector('tr[data-row-key="cur_alpha"]')
    const open = within(row).getByText('Mở yêu cầu').closest('button')
    expect(open).toBeEnabled()

    await user.click(open)

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/app/recruiters/usr_owner?tab=verification&company_update=cur_alpha',
    )
  })
})
