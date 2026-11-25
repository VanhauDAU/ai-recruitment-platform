import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountManagement from './AdminAccountManagement'

const { accountApi, verificationApi, useSession } = vi.hoisted(() => ({
  accountApi: {
    getAdminAccounts: vi.fn(),
    getAdminAccountSummary: vi.fn(),
    updateAdminAccount: vi.fn(),
  },
  verificationApi: {
    getAdminCompanyDomainClaims: vi.fn(),
    getAdminCompanyDomainClaimSummary: vi.fn(),
    getAdminEmployerVerifications: vi.fn(),
  },
  useSession: vi.fn(),
}))

vi.mock('@/entities/account/admin-account', async (importOriginal) => ({
  ...(await importOriginal()),
  ...accountApi,
}))
vi.mock('@/entities/company/admin-employer-verification', async (importOriginal) => ({
  ...(await importOriginal()),
  ...verificationApi,
}))
vi.mock('@/entities/account/session', () => ({ useSession }))

const SUMMARY = {
  scope: 'users',
  totals: {
    total: 200,
    active: 150,
    restricted: 20,
    unverified: 50,
  },
  by_role: {
    candidate: { total: 180, active: 140, restricted: 15, unverified: 45 },
    admin: { total: 20, active: 10, restricted: 5, unverified: 5 },
  },
  queues: { pending_admin_invitations: 2 },
}

function renderWidget({
  isSuperuser = true,
  scope = 'accounts',
  initialEntry = '/',
} = {}) {
  useSession.mockReturnValue({
    user: {
      role: 'admin',
      admin_access: { is_superuser: isSuperuser },
    },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminAccountManagement scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const statCard = (label) => screen
  .getByText(label, { selector: '.wt-tile__label' })
  .closest('button')
// Thẻ tồn tại ngay từ lần render đầu với giá trị 0, nên phải chờ số liệu thật.
const waitForSummary = () => waitFor(
  () => expect(statCard('Tổng tài khoản')).toHaveTextContent('200'),
)

describe('AdminAccountManagement overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accountApi.getAdminAccountSummary.mockResolvedValue(SUMMARY)
    accountApi.getAdminAccounts.mockResolvedValue({ count: 0, results: [] })
    verificationApi.getAdminEmployerVerifications.mockResolvedValue({ count: 0, results: [] })
    verificationApi.getAdminCompanyDomainClaims.mockResolvedValue({ count: 0, results: [] })
    verificationApi.getAdminCompanyDomainClaimSummary.mockResolvedValue({
      total: 3,
      manual_pending: 2,
    })
  })

  it('shows each account stat with its share of the total', async () => {
    renderWidget()

    await waitForSummary()
    expect(accountApi.getAdminAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'users' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(within(statCard('Đang hoạt động')).getByText('150')).toBeInTheDocument()
    expect(statCard('Bị hạn chế')).toHaveTextContent('20')
    expect(statCard('Email chưa xác minh')).toHaveTextContent('50')
    expect(statCard('Tổng tài khoản')).toHaveAttribute('aria-pressed', 'true')

    statCard('Bị hạn chế').click()

    await waitFor(() => expect(accountApi.getAdminAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'inactive,banned' }),
      expect.anything(),
    ))
    await waitFor(() => expect(statCard('Bị hạn chế')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('keeps employer verification out of the general account workspace', async () => {
    renderWidget()

    await waitForSummary()
    expect(screen.queryByText('Hồ sơ NTD chờ duyệt')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Chờ xác thực NTD/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Nhà tuyển dụng' })).not.toBeInTheDocument()
  })

  it('provides a focused recruiter workspace', async () => {
    renderWidget({
      scope: 'recruiters',
      initialEntry: '/?tab=verification',
    })

    expect(await screen.findByRole('tab', { name: /Chờ xác thực NTD/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /Danh sách NTD/ })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /Xác minh domain/ })).toHaveTextContent('2')
    // Segment tiles belong to the recruiter list, not to the review queues.
    expect(screen.queryByLabelText('Tổng quan nhà tuyển dụng')).not.toBeInTheDocument()
  })

  it('turns a segment tile into the matching server filter', async () => {
    accountApi.getAdminAccountSummary.mockResolvedValue({
      scope: 'recruiters',
      totals: { total: 40, restricted: 3 },
      companyless: 5,
      next_actions: { admin_queue: 7, verification_overdue: 2, awaiting_resubmission: 4 },
      verification: { pending: 6 },
    })
    renderWidget({ scope: 'recruiters', initialEntry: '/?page_size=40' })

    const tile = (await screen.findByText('Cần admin duyệt')).closest('button')
    await waitFor(() => expect(tile).toHaveTextContent('7'))
    tile.click()

    await waitFor(() => expect(accountApi.getAdminAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'recruiters',
        next_action: 'admin_queue',
        ordering: 'next_action',
        page_size: 40,
      }),
      expect.anything(),
    ))
    expect(screen.getByRole('tab', { name: /Danh sách NTD/ })).toHaveAttribute('aria-selected', 'true')
    expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the whole recruiter workspace to a regular admin', async () => {
    renderWidget({ isSuperuser: false, scope: 'recruiters' })

    expect(await screen.findByRole('tab', { name: /Danh sách NTD/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await waitFor(() => expect(accountApi.getAdminAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'recruiters' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(screen.getByRole('tab', { name: /Chờ xác thực NTD/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Xác minh domain/ })).toBeInTheDocument()
  })

  it('shows admin accounts and invitations to a superuser only', async () => {
    renderWidget()

    await waitForSummary()
    expect(screen.getByRole('tab', { name: /Tất cả người dùng/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Quản trị viên/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Lời mời quản trị/ })).toBeInTheDocument()
  })

  it('limits a regular admin to candidate accounts, even from an admin-tab URL', async () => {
    renderWidget({ isSuperuser: false, initialEntry: '/?tab=invitations' })

    expect(await screen.findByRole('tab', { name: /Ứng viên/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('tab', { name: /Tất cả người dùng/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Quản trị viên/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Lời mời quản trị/ })).not.toBeInTheDocument()
    await waitFor(() => expect(accountApi.getAdminAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'users', role: 'candidate' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it('does not mix company-update requests into account tabs', async () => {
    renderWidget()

    await waitForSummary()
    expect(screen.queryByRole('tab', { name: /Sửa thông tin công ty/ })).not.toBeInTheDocument()
  })
})
