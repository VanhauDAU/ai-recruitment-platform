import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Card,
  Form,
} from 'antd'
import {
  adminAccessKeys,
  createAdminDepartment,
  createAdminRole,
  getAdminDepartments,
  getAdminMemberships,
  getAdminPermissions,
  getAdminRoles,
  getAdminStaff,
  updateAdminDepartment,
  updateAdminRole,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { activeRoleOptions, pagedResults } from '../model/access-control-view'
import { generateAccessCode } from '../model/generate-access-code'
import { confirmImpact, fetchImpact } from '../model/impact-actions'
import AccessControlModals from './AccessControlModals'
import AccessControlTabs from './AccessControlTabs'

export default function AdminAccessControl() {
  const { user } = useSession()
  const { isSuperuser } = useAdminAccess(user)
  const queryClient = useQueryClient()
  const [departmentForm] = Form.useForm()
  const [roleForm] = Form.useForm()
  const [assignmentForm] = Form.useForm()
  const [departmentEditor, setDepartmentEditor] = useState(null)
  const [roleEditor, setRoleEditor] = useState(null)
  const [permissionEditor, setPermissionEditor] = useState(null)
  const [permissionCodes, setPermissionCodes] = useState([])
  const [assignmentEditor, setAssignmentEditor] = useState(null)
  const [staffSearch, setStaffSearch] = useState('')
  const deferredStaffSearch = useDeferredValue(staffSearch.trim())
  const [roleFilter, setRoleFilter] = useState('')
  const [includeRevoked, setIncludeRevoked] = useState(false)
  const [membershipPage, setMembershipPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [danger, setDanger] = useState(null)

  const departmentsQuery = useQuery({
    queryKey: adminAccessKeys.departments,
    queryFn: ({ signal }) => getAdminDepartments({ signal }),
  })
  const rolesQuery = useQuery({
    queryKey: adminAccessKeys.roles(roleFilter),
    queryFn: ({ signal }) => getAdminRoles(roleFilter, { signal }),
  })
  const membershipsParams = useMemo(() => ({
    page: membershipPage,
    include_revoked: includeRevoked,
  }), [includeRevoked, membershipPage])
  const membershipsQuery = useQuery({
    queryKey: adminAccessKeys.memberships(membershipsParams),
    queryFn: ({ signal }) => getAdminMemberships(membershipsParams, { signal }),
    enabled: isSuperuser,
  })
  const permissionQuery = useQuery({
    queryKey: adminAccessKeys.permissions(permissionEditor?.public_id || ''),
    queryFn: ({ signal }) => getAdminPermissions(permissionEditor.public_id, { signal }),
    enabled: Boolean(permissionEditor),
  })
  const staffQuery = useQuery({
    queryKey: adminAccessKeys.staff(deferredStaffSearch),
    queryFn: ({ signal }) => getAdminStaff(deferredStaffSearch, { signal }),
    enabled: Boolean(assignmentEditor),
  })
  const assignmentRolesQuery = useQuery({
    queryKey: adminAccessKeys.roles(''),
    queryFn: ({ signal }) => getAdminRoles('', { signal }),
    enabled: Boolean(assignmentEditor),
  })

  const departments = departmentsQuery.data || []
  const roles = rolesQuery.data || []
  const assignmentRoles = assignmentRolesQuery.data || []
  const memberships = pagedResults(membershipsQuery.data)
  const staff = pagedResults(staffQuery.data)
  const roleOptions = activeRoleOptions(
    departments,
    assignmentRoles,
    assignmentEditor?.member?.role.public_id,
  )

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: adminAccessKeys.all })
  }

  const openDepartmentEditor = (row = null) => {
    departmentForm.setFieldsValue(row || { name: '', description: '' })
    setDepartmentEditor({ row })
  }

  const saveDepartment = async () => {
    const values = await departmentForm.validateFields()
    setSaving(true)
    try {
      if (departmentEditor.row) {
        await updateAdminDepartment(departmentEditor.row.public_id, values)
      } else {
        await createAdminDepartment({
          ...values,
          code: generateAccessCode(values.name),
        })
      }
      message.success('Đã lưu phòng ban.')
      setDepartmentEditor(null)
      departmentForm.resetFields()
      await invalidateAll()
    } catch (error) {
      if (!error?.errorFields) message.error(getApiErrorMessage(error, 'Không thể lưu phòng ban.'))
    } finally {
      setSaving(false)
    }
  }

  const openRoleEditor = (row = null) => {
    roleForm.setFieldsValue(row ? {
      name: row.name,
      description: row.description,
      rank: row.rank,
    } : {
      department: departments[0]?.public_id,
      name: '',
      description: '',
      rank: 0,
    })
    setRoleEditor({ row })
  }

  const saveRole = async () => {
    const values = await roleForm.validateFields()
    setSaving(true)
    try {
      if (roleEditor.row) await updateAdminRole(roleEditor.row.public_id, values)
      else {
        await createAdminRole({
          ...values,
          code: generateAccessCode(values.name),
        })
      }
      message.success('Đã lưu chức danh.')
      setRoleEditor(null)
      roleForm.resetFields()
      await invalidateAll()
    } catch (error) {
      if (!error?.errorFields) message.error(getApiErrorMessage(error, 'Không thể lưu chức danh.'))
    } finally {
      setSaving(false)
    }
  }

  const openPermissions = (role) => {
    setPermissionCodes(role.permission_codes || [])
    setPermissionEditor(role)
  }

  const loadImpact = async (descriptor, { stale = false } = {}) => {
    setDanger({ ...descriptor, loading: true, stale, preview: null, error: null })
    try {
      const preview = await fetchImpact(descriptor)
      setDanger({ ...descriptor, loading: false, stale, preview, error: null })
    } catch (error) {
      setDanger({
        ...descriptor,
        loading: false,
        stale,
        preview: null,
        error: getApiErrorMessage(error, 'Không thể tải số liệu tác động.'),
      })
    }
  }

  const applyDangerousAction = async () => {
    if (!danger?.preview?.impact_token) return
    setDanger((current) => ({ ...current, confirming: true }))
    try {
      await confirmImpact(danger, danger.preview.impact_token)
      message.success('Đã cập nhật phân quyền.')
      if (danger.kind === 'rolePermissions') setPermissionEditor(null)
      if (danger.kind === 'assignment') {
        setAssignmentEditor(null)
        assignmentForm.resetFields()
      }
      setDanger(null)
      await invalidateAll()
    } catch (error) {
      if (
        error?.response?.status === 409
        && error?.response?.data?.code === 'admin_resource_changed'
      ) {
        message.warning('Dữ liệu đã thay đổi. Hãy xem lại tác động mới.')
        await loadImpact(danger, { stale: true })
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể hoàn tất thao tác.'))
      setDanger((current) => ({ ...current, confirming: false }))
    }
  }

  const previewPermissionChange = () => {
    const activeCodes = permissionCodes.filter((code) => (
      permissionQuery.data?.some((item) => item.code === code && item.is_active)
    ))
    loadImpact({
      kind: 'rolePermissions',
      target: permissionEditor,
      payload: { permission_codes: activeCodes.sort() },
    })
  }

  const previewAssignment = async () => {
    const values = await assignmentForm.validateFields()
    loadImpact({ kind: 'assignment', payload: values })
  }

  const openAssignment = (member = null) => {
    assignmentForm.resetFields()
    if (member) assignmentForm.setFieldsValue({ user_public_id: member.user.public_id })
    setStaffSearch('')
    setAssignmentEditor({ member })
  }

  return (
    <div className="space-y-5">
      {!isSuperuser && (
        <Alert
          showIcon
          type="info"
          title="Chế độ chỉ đọc"
          description="Chỉ superuser được xem dữ liệu nhân sự hoặc thay đổi cấu hình phân quyền."
        />
      )}

      <Card className="border-slate-200 shadow-sm">
        <AccessControlTabs
          isSuperuser={isSuperuser}
          department={{
            items: departments,
            query: departmentsQuery,
            onEdit: openDepartmentEditor,
            onImpact: loadImpact,
          }}
          role={{
            items: roles,
            query: rolesQuery,
            filter: roleFilter,
            onFilterChange: setRoleFilter,
            onEdit: openRoleEditor,
            onEditPermissions: openPermissions,
            onImpact: loadImpact,
          }}
          membership={{
            items: memberships,
            query: membershipsQuery,
            page: membershipPage,
            includeRevoked,
            onPageChange: setMembershipPage,
            onIncludeRevokedChange: (checked) => {
              setIncludeRevoked(checked)
              setMembershipPage(1)
            },
            onAssign: () => openAssignment(),
            onReplace: openAssignment,
            onImpact: loadImpact,
          }}
        />
      </Card>

      <AccessControlModals
        department={{
          editor: departmentEditor,
          form: departmentForm,
          saving,
          onClose: () => setDepartmentEditor(null),
          onSave: saveDepartment,
        }}
        role={{
          editor: roleEditor,
          form: roleForm,
          departments,
          saving,
          onClose: () => setRoleEditor(null),
          onSave: saveRole,
        }}
        permission={{
          editor: permissionEditor,
          query: permissionQuery,
          codes: permissionCodes,
          onClose: () => setPermissionEditor(null),
          onPreview: previewPermissionChange,
          onCodesChange: setPermissionCodes,
        }}
        assignment={{
          open: Boolean(assignmentEditor),
          member: assignmentEditor?.member || null,
          form: assignmentForm,
          staff,
          staffQuery,
          rolesQuery: assignmentRolesQuery,
          roleOptions,
          onClose: () => setAssignmentEditor(null),
          onPreview: previewAssignment,
          onSearch: setStaffSearch,
        }}
        impact={{
          value: danger,
          onClose: () => setDanger(null),
          onApply: applyDangerousAction,
          onReload: () => loadImpact(danger),
        }}
      />
    </div>
  )
}
