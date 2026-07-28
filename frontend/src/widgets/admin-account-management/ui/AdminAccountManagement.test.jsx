import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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
}

function renderWidget({
  isSuperuser = true,
  permissions = [],
  scope = 'accounts',
  initialEntry = '/',
} = {}) {
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
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdminAccountManagement scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const statCard = (label) => screen.getByText(label, { selector: '.account-stat p' }).closest('.account-stat')
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
  })

  it('shows each account stat with its share of the total', async () => {
    renderWidget()

    await waitForSummary()
    expect(within(statCard('Đang hoạt động')).getByText('150')).toBeInTheDocument()
    expect(statCard('Đang hoạt động')).toHaveTextContent('75% tài khoản đăng nhập được')
    expect(statCard('Bị hạn chế')).toHaveTextContent('10% đang tạm khóa hoặc bị cấm')
    expect(statCard('Email chưa xác minh')).toHaveTextContent('25% chưa hoàn tất xác thực')
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
    expect(screen.getByRole('tab', { name: 'Danh sách NTD' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Tổng quan tài khoản')).not.toBeInTheDocument()
  })

  it('does not mix company-update requests into account tabs', async () => {
    renderWidget()

    await waitForSummary()
    expect(screen.queryByRole('tab', { name: /Sửa thông tin công ty/ })).not.toBeInTheDocument()
  })
})
