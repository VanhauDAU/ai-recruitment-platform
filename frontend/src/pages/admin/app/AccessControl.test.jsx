import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccessControl from './AccessControl'

const { api, message, useSession } = vi.hoisted(() => {
  const names = [
    'createAdminDepartment',
    'createAdminMembership',
    'createAdminRole',
    'getAdminDepartments',
    'getAdminMemberships',
    'getAdminPermissions',
    'getAdminRoles',
    'getAdminStaff',
    'getDepartmentRestoreImpact',
    'getDepartmentStatusImpact',
    'getMembershipAssignmentImpact',
    'getMembershipRevokeImpact',
    'getRolePermissionsImpact',
    'getRoleRestoreImpact',
    'getRoleStatusImpact',
    'restoreAdminDepartment',
    'restoreAdminRole',
    'revokeAdminMembership',
    'setAdminDepartmentStatus',
    'setAdminRoleStatus',
    'updateAdminDepartment',
    'updateAdminRole',
    'updateAdminRolePermissions',
  ]
  return {
    api: Object.fromEntries(names.map((name) => [name, vi.fn()])),
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    useSession: vi.fn(),
  }
})

vi.mock('@/entities/admin-access', async (importOriginal) => ({
  ...(await importOriginal()),
  ...api,
}))
vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/shared/lib/toast', () => ({ message }))

const department = {
  public_id: 'dept_content',
  code: 'content-cv',
  name: 'Nội dung & CV',
  description: 'Mặc định',
  is_active: true,
  is_system_managed: true,
  is_restorable: true,
  role_count: 1,
  active_member_count: 1,
  revoked_member_count: 0,
}
const role = {
  public_id: 'role_staff',
  department: {
    public_id: department.public_id,
    code: department.code,
    name: department.name,
  },
  code: 'staff',
  name: 'Nhân viên',
  description: '',
  rank: 10,
  is_active: true,
  is_system_managed: true,
  is_restorable: true,
  permission_codes: ['cv_template.view'],
  active_member_count: 1,
}
const membership = {
  public_id: 'membership_1',
  user: {
    public_id: 'user_1',
    email: 'staff@example.com',
    full_name: 'Nguyễn Văn A',
    two_factor_enabled: false,
  },
  department: role.department,
  role: {
    public_id: role.public_id,
    code: role.code,
    name: role.name,
    rank: role.rank,
  },
  is_active: true,
  assigned_at: '2026-07-25T00:00:00Z',
  revoked_at: null,
  assigned_by_email: 'root@example.com',
}
const permission = {
  code: 'cv_template.view',
  module: 'cv_template',
  label: 'Xem catalogue CV',
  description: 'Xem CV.',
  is_active: true,
  is_granted_to_role: true,
}

function session(superuser) {
  return {
    user: {
      role: 'admin',
      admin_access: {
        is_superuser: superuser,
        permissions: ['admin_access.view'],
        primary_department: null,
        memberships: [],
      },
    },
  }
}

function renderPage(superuser = true) {
  useSession.mockReturnValue(session(superuser))
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AccessControl />
    </QueryClientProvider>,
  )
}

describe('AccessControl', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    Object.values(message).forEach((mock) => mock.mockReset())
    useSession.mockReset()
    api.getAdminDepartments.mockResolvedValue([department])
    api.getAdminRoles.mockResolvedValue([role])
    api.getAdminMemberships.mockResolvedValue({ count: 1, results: [membership] })
    api.getAdminPermissions.mockResolvedValue([permission])
    api.getAdminStaff.mockResolvedValue({ count: 0, results: [] })
  })

  it('hides all writes and personnel data from a non-superuser', async () => {
    renderPage(false)
    expect(await screen.findByText('Nội dung & CV')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Nhân viên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thêm phòng ban|Sửa|Khoá/ })).not.toBeInTheDocument()
    expect(screen.getByText('Chế độ chỉ đọc')).toBeInTheDocument()
    expect(api.getAdminMemberships).not.toHaveBeenCalled()
  })

  it('shows the MFA warning in the superuser personnel tab', async () => {
    renderPage(true)
    fireEvent.click(await screen.findByRole('tab', { name: 'Nhân viên' }))

    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Chưa bật MFA')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên & chức danh')).toBeInTheDocument()
    expect(screen.getByText('Mỗi nhân viên chỉ có một chức danh đang hiệu lực.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gán chức danh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi chức danh' })).toBeInTheDocument()
  })

  it('derives a department code from its name instead of asking an admin to enter one', async () => {
    api.createAdminDepartment.mockResolvedValue({ ...department, public_id: 'dept_legal' })
    renderPage(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm phòng ban' }))

    const nameInput = screen.getByLabelText('Tên phòng ban')
    fireEvent.change(nameInput, { target: { value: 'Pháp chế' } })

    expect(screen.queryByLabelText(/Mã phòng ban/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng ban' }))
    await waitFor(() => {
      expect(api.createAdminDepartment).toHaveBeenCalledWith({
        name: 'Pháp chế',
        description: '',
        code: 'phap-che',
      })
    })
  })

  it('uses real permission impact and disables confirmation when blocked', async () => {
    api.getRolePermissionsImpact.mockResolvedValue({
      permissions_added: [],
      permissions_removed: ['cv_template.view'],
      active_membership_count: 1,
      effective_users_changed_count: 1,
      affected_user_count: 1,
      affected_users_preview: [{
        public_id: 'user_1',
        email: 'staff@example.com',
        full_name: 'Nguyễn Văn A',
      }],
      preview_limit: 20,
      has_more: false,
      can_apply: false,
      blocking_reason: 'Không thể xoá toàn bộ quyền vì chức danh đang có 1 nhân viên hoạt động.',
      impact_token: 'blocked-token',
    })
    renderPage(true)
    fireEvent.click(await screen.findByRole('tab', { name: 'Chức danh' }))
    fireEvent.click(await screen.findByRole('button', { name: /Quyền/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Xem catalogue CV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    expect(await screen.findByText(/Không thể xoá toàn bộ quyền/)).toBeInTheDocument()
    expect(screen.getByText('1 nhân viên bị ảnh hưởng')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi quyền' })).toBeDisabled()
    expect(api.getRolePermissionsImpact).toHaveBeenCalledWith(role.public_id, [])
  }, 90_000)

  it('reloads impact after a 409 and requires a second review', async () => {
    const first = {
      desired_state: 'inactive',
      active_membership_count: 1,
      effective_users_changed_count: 1,
      affected_user_count: 1,
      affected_users_preview: [membership.user],
      preview_limit: 20,
      has_more: false,
      impact_token: 'old-token',
    }
    const refreshed = { ...first, active_membership_count: 2, impact_token: 'new-token' }
    api.getRoleStatusImpact
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(refreshed)
    api.setAdminRoleStatus.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { code: 'admin_resource_changed' },
      },
    })
    renderPage(true)
    fireEvent.click(await screen.findByRole('tab', { name: 'Chức danh' }))
    const table = await screen.findByRole('table')
    fireEvent.click(within(table).getByRole('button', { name: 'Thao tác khác cho Nhân viên' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Khoá' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đổi trạng thái' }))

    expect(await screen.findByText('Dữ liệu đã thay đổi')).toBeInTheDocument()
    expect(api.getRoleStatusImpact).toHaveBeenCalledTimes(2)
    expect(api.setAdminRoleStatus).toHaveBeenCalledWith(role.public_id, false, 'old-token')
    expect(message.warning).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  }, 90_000)

  it('requests a new impact token after the permission payload changes', async () => {
    api.getRolePermissionsImpact.mockResolvedValue({
      permissions_added: [],
      permissions_removed: [],
      active_membership_count: 1,
      effective_users_changed_count: 0,
      affected_user_count: 0,
      affected_users_preview: [],
      preview_limit: 20,
      has_more: false,
      can_apply: true,
      blocking_reason: null,
      impact_token: 'fresh-token',
    })
    renderPage(true)
    fireEvent.click(await screen.findByRole('tab', { name: 'Chức danh' }))
    fireEvent.click(await screen.findByRole('button', { name: /Quyền/ }))
    const checkbox = await screen.findByRole('checkbox', { name: 'Xem catalogue CV' })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))
    await waitFor(() => expect(api.getRolePermissionsImpact).toHaveBeenCalledTimes(1))
    expect(api.getRolePermissionsImpact).toHaveBeenLastCalledWith(role.public_id, [])

    const dialogs = await screen.findAllByRole('dialog')
    fireEvent.click(within(dialogs.at(-1)).getByRole('button', { name: 'Close' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Xem catalogue CV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xem tác động' }))

    await waitFor(() => expect(api.getRolePermissionsImpact).toHaveBeenCalledTimes(2))
    expect(api.getRolePermissionsImpact).toHaveBeenLastCalledWith(
      role.public_id,
      ['cv_template.view'],
    )
  }, 90_000)

  it('opens the employee detail drawer from the personnel table', async () => {
    renderPage(true)
    fireEvent.click(await screen.findByRole('tab', { name: 'Nhân viên' }))
    fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết Nguyễn Văn A/ }))

    expect(await screen.findByText('Chi tiết nhân viên')).toBeInTheDocument()
    expect(screen.getByText('Người cấp')).toBeInTheDocument()
    expect(screen.getByText('root@example.com')).toBeInTheDocument()
  })
})
