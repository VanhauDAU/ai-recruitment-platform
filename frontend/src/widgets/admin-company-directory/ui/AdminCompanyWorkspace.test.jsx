import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCompanyWorkspace from './AdminCompanyWorkspace'

const { companyApi, updateApi, useSession } = vi.hoisted(() => ({
  companyApi: {
    getAdminCompanies: vi.fn(),
    getAdminCompanySummary: vi.fn(),
  },
  updateApi: {
    getAdminCompanyUpdateRequests: vi.fn(),
  },
  useSession: vi.fn(),
}))

vi.mock('@/entities/admin-company', async (importOriginal) => ({
  ...(await importOriginal()),
  ...companyApi,
}))
vi.mock('@/entities/admin-employer-verification', async (importOriginal) => ({
  ...(await importOriginal()),
  ...updateApi,
}))
vi.mock('@/entities/session', () => ({ useSession }))

function renderWorkspace({ permissions = [], initialEntry = '/admin/app/companies' } = {}) {
  useSession.mockReturnValue({
    user: {
      role: 'admin',
      admin_access: {
        is_superuser: false,
        permissions,
        memberships: [],
      },
    },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminCompanyWorkspace />
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
      verification: {},
      pending_update_requests: 0,
    })
    updateApi.getAdminCompanyUpdateRequests.mockResolvedValue({ count: 0, results: [] })
  })

  it('keeps update requests in the company workspace for its dedicated permission', async () => {
    renderWorkspace({ permissions: ['company_update.view'] })

    expect(screen.queryByRole('tab', { name: 'Danh sách công ty' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Yêu cầu cập nhật' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Ưu tiên yêu cầu có thay đổi pháp lý')).toBeInTheDocument()
    await waitFor(() => expect(updateApi.getAdminCompanyUpdateRequests).toHaveBeenCalled())
    expect(companyApi.getAdminCompanies).not.toHaveBeenCalled()
  })

  it('opens the requested company update tab with its company filter', async () => {
    renderWorkspace({
      permissions: ['company.view', 'company_update.view'],
      initialEntry: '/admin/app/companies?tab=updates&company=co_alpha',
    })

    expect(screen.getByRole('tab', { name: 'Yêu cầu cập nhật' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await waitFor(() => expect(updateApi.getAdminCompanyUpdateRequests).toHaveBeenCalledWith(
      {
        page: 1,
        status: 'pending',
        company: 'co_alpha',
        ordering: '-updated_at',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(companyApi.getAdminCompanies).not.toHaveBeenCalled()
  })

  it('falls back to the directory when update access is unavailable', async () => {
    renderWorkspace({
      permissions: ['company.view'],
      initialEntry: '/admin/app/companies?tab=updates',
    })

    expect(screen.getByRole('tab', { name: 'Danh sách công ty' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('tab', { name: 'Yêu cầu cập nhật' })).not.toBeInTheDocument()
    await waitFor(() => expect(companyApi.getAdminCompanies).toHaveBeenCalled())
    expect(updateApi.getAdminCompanyUpdateRequests).not.toHaveBeenCalled()
  })

  it('opens the update queue from the overview shortcut', async () => {
    const user = userEvent.setup()
    renderWorkspace({ permissions: ['company.view', 'company_update.view'] })

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
    renderWorkspace({
      permissions: ['company.view', 'company_update.view'],
      initialEntry: '/admin/app/companies?tab=updates',
    })

    expect(await screen.findByText('Công ty Alpha')).toBeInTheDocument()
    expect(screen.getByText('Tên pháp lý')).toBeInTheDocument()
    expect(screen.getByText('Mã số thuế')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Thay đổi pháp lý')).toBeInTheDocument()
    expect(screen.getByText('1 tài liệu · Giấy đăng ký doanh nghiệp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mở yêu cầu/ })).toBeInTheDocument()
  }, 10000)
})
