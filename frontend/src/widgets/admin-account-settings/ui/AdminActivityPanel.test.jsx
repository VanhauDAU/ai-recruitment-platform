import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminActivityPanel from './AdminActivityPanel'

const { getAdminAuditLogs, listSessionHistory, useSession } = vi.hoisted(() => ({
  getAdminAuditLogs: vi.fn(),
  listSessionHistory: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/features/session-management', () => ({
  groupSessions: (sessions) => sessions,
  listSessionHistory,
}))
vi.mock('@/entities/admin-access', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAuditLogs,
}))

function adminUser(permissions, isSuperuser = false) {
  return {
    email: 'staff@example.com',
    role: 'admin',
    admin_access: { is_superuser: isSuperuser, permissions, memberships: [], primary_department: null },
  }
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AdminActivityPanel />
    </QueryClientProvider>,
  )
}

describe('AdminActivityPanel', () => {
  beforeEach(() => {
    getAdminAuditLogs.mockReset()
    listSessionHistory.mockReset()
    listSessionHistory.mockResolvedValue([])
    getAdminAuditLogs.mockResolvedValue({
      count: 1,
      results: [{
        public_id: 'alog_1',
        action: 'self_password_change',
        source: 'api',
        actor_email: 'staff@example.com',
        actor_identifier: '',
        target_type: 'user',
        target_public_id: 'usr_1',
        payload: {},
        created_at: '2026-07-20T03:00:00Z',
      }],
    })
  })

  it('renders audit rows with the Vietnamese action label', async () => {
    useSession.mockReturnValue({ user: adminUser([]) })

    renderPanel()

    expect(await screen.findByText('Đổi mật khẩu')).toBeInTheDocument()
    expect(screen.getByText('Giao diện quản trị')).toBeInTheDocument()
  })

  it('hides the system-wide toggle without the audit_log.view permission', async () => {
    useSession.mockReturnValue({ user: adminUser([]) })

    renderPanel()
    await screen.findByText('Đổi mật khẩu')

    expect(screen.queryByLabelText('Xem nhật ký toàn hệ thống')).not.toBeInTheDocument()
    expect(getAdminAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ scope: 'mine' }))
  })

  it('shows the system-wide toggle when the permission is granted', async () => {
    useSession.mockReturnValue({ user: adminUser(['audit_log.view']) })

    renderPanel()
    await screen.findByText('Đổi mật khẩu')

    expect(screen.getByLabelText('Xem nhật ký toàn hệ thống')).toBeInTheDocument()
  })

  it('shows the toggle for a superuser even without an explicit permission', async () => {
    useSession.mockReturnValue({ user: adminUser([], true) })

    renderPanel()
    await screen.findByText('Đổi mật khẩu')

    expect(screen.getByLabelText('Xem nhật ký toàn hệ thống')).toBeInTheDocument()
  })

  it('lists login history including revoked sessions', async () => {
    useSession.mockReturnValue({ user: adminUser([]) })
    listSessionHistory.mockResolvedValue([
      { id: 's1', device_label: 'Chrome trên macOS', ip_address: '1.2.3.4', created_at: '2026-07-20T03:00:00Z', revoked_at: null, current: true },
      { id: 's2', device_label: 'Safari trên iPhone', ip_address: null, created_at: '2026-07-19T03:00:00Z', revoked_at: '2026-07-19T05:00:00Z', current: false },
    ])

    renderPanel()

    expect(await screen.findByText('Chrome trên macOS')).toBeInTheDocument()
    expect(screen.getByText('Thiết bị này')).toBeInTheDocument()
    expect(screen.getByText('Đã đăng xuất')).toBeInTheDocument()
  })
})
