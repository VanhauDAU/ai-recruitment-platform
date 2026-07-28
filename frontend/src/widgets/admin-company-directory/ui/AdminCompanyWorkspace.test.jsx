import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByRole('heading', {
      name: 'Yêu cầu cập nhật thông tin công ty',
    })).toBeInTheDocument()
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
})
