import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountManagement from './AdminAccountManagement'

const { accountApi, accessApi, verificationApi, useSession } = vi.hoisted(() => ({
  accountApi: {
    getAdminAccounts: vi.fn(),
    getAdminAccountSummary: vi.fn(),
    updateAdminAccount: vi.fn(),
  },
  accessApi: {
    getAdminDepartments: vi.fn(),
    getAdminRoles: vi.fn(),
  },
  verificationApi: {
    getAdminCompanyUpdateRequests: vi.fn(),
    getAdminEmployerVerifications: vi.fn(),
  },
  useSession: vi.fn(),
}))

vi.mock('@/entities/admin-account', async (importOriginal) => ({
  ...(await importOriginal()),
  ...accountApi,
}))
vi.mock('@/entities/admin-access', async (importOriginal) => ({
  ...(await importOriginal()),
  ...accessApi,
}))
vi.mock('@/entities/admin-employer-verification', async (importOriginal) => ({
  ...(await importOriginal()),
  ...verificationApi,
}))
vi.mock('@/entities/session', () => ({ useSession }))

const SUMMARY = {
  total: 200,
  active: 150,
  restricted: 20,
  unverified: 50,
  pending_admin: 2,
  employer_verification_pending: 4,
  employer_verification_overdue: 1,
  company_update_pending: 0,
}

function renderWidget({ isSuperuser = true, permissions = [] } = {}) {
  useSession.mockReturnValue({
    user: {
      role: 'admin',
      admin_access: {
        is_superuser: isSuperuser,
        permissions,
        primary_department: null,
        memberships: [],
      },
    },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAccountManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Nhãn thẻ hàng chờ trùng với nhãn tab tương ứng nên phải khoanh theo selector.
const statCard = (label) => screen.getByText(label, { selector: '.account-stat p' }).closest('.account-stat')
const queueCard = (label) => screen.getByText(label, { selector: '.account-queue__label' }).closest('.account-queue')
// Thẻ tồn tại ngay từ lần render đầu với giá trị 0, nên phải chờ số liệu thật.
const waitForSummary = () => waitFor(
  () => expect(statCard('Tổng tài khoản')).toHaveTextContent('200'),
)

describe('AdminAccountManagement overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accountApi.getAdminAccountSummary.mockResolvedValue(SUMMARY)
    accountApi.getAdminAccounts.mockResolvedValue({ count: 0, results: [] })
    accessApi.getAdminDepartments.mockResolvedValue([])
    accessApi.getAdminRoles.mockResolvedValue([])
    verificationApi.getAdminEmployerVerifications.mockResolvedValue({ count: 0, results: [] })
    verificationApi.getAdminCompanyUpdateRequests.mockResolvedValue({ count: 0, results: [] })
  })

  it('shows each account stat with its share of the total', async () => {
    renderWidget()

    await waitForSummary()
    expect(within(statCard('Đang hoạt động')).getByText('150')).toBeInTheDocument()
    expect(statCard('Đang hoạt động')).toHaveTextContent('75% tài khoản đăng nhập được')
    expect(statCard('Bị hạn chế')).toHaveTextContent('10% đang tạm khóa hoặc bị cấm')
    expect(statCard('Email chưa xác minh')).toHaveTextContent('25% chưa hoàn tất xác thực')
  })

  it('warns about overdue cases and mutes an empty queue', async () => {
    renderWidget()

    await waitForSummary()
    expect(queueCard('Hồ sơ NTD chờ duyệt')).toHaveTextContent('1 hồ sơ đã chờ quá 72 giờ')
    expect(queueCard('Hồ sơ NTD chờ duyệt')).toHaveClass('account-queue--red')
    // Hàng chờ rỗng phải về tông trung tính dù cấu hình là amber.
    expect(queueCard('Sửa thông tin công ty')).toHaveClass('account-queue--slate')
    expect(screen.getByText('6 việc đang chờ')).toBeInTheDocument()
  })

  it('opens the matching tab when a queue card is clicked', async () => {
    renderWidget()

    await waitForSummary()
    await userEvent.click(queueCard('Hồ sơ NTD chờ duyệt'))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Chờ xác thực NTD/ })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('shows only the company-update queue for its dedicated view permission', async () => {
    renderWidget({ isSuperuser: false, permissions: ['company_update.view'] })

    await waitForSummary()
    expect(screen.getByRole('tab', { name: /Sửa thông tin công ty/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: /Chờ xác thực NTD/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Tất cả' })).not.toBeInTheDocument()
    await waitFor(() => expect(verificationApi.getAdminCompanyUpdateRequests).toHaveBeenCalled())
    expect(verificationApi.getAdminEmployerVerifications).not.toHaveBeenCalled()
    expect(accountApi.getAdminAccounts).not.toHaveBeenCalled()
  })
})
