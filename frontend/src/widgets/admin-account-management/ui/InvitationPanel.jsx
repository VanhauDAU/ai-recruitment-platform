import {
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import {
  adminAccountKeys,
  createAdminInvitation,
  formatAdminDate,
  getAdminInvitations,
  getAvailableAdminInvitationRoles,
  resendAdminInvitation,
  revokeAdminInvitation,
  updateAdminInvitation,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { InvitationStatusTag } from './AccountStatusTag'

function RoleSummary({ role }) {
  if (!role) return null
  return (
    <div className="invitation-role-summary">
      <div>
        <span>Phòng ban</span>
        <strong>{role.department.name}</strong>
      </div>
      <div>
        <span>Chức danh</span>
        <strong>{role.name}</strong>
      </div>
      <div className="invitation-role-summary__permissions">
        <span>{`${role.permission_codes.length} quyền sẽ được cấp`}</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {role.permission_codes.slice(0, 8).map((code) => <Tag key={code}>{code}</Tag>)}
          {role.permission_codes.length > 8 && (
            <Tag>{`+${role.permission_codes.length - 8} quyền`}</Tag>
          )}
        </div>
      </div>
    </div>
  )
}

function InvitationModal({
  editor,
  roles,
  loading,
  form,
  onClose,
  onSave,
}) {
  const selectedRoleId = Form.useWatch('target_role_public_id', form)
  const selectedRole = roles.find((item) => item.public_id === selectedRoleId)
  const editing = Boolean(editor?.invitation)

  return (
    <Modal
      open={Boolean(editor)}
      width={680}
      title={editing ? 'Đổi chức danh lời mời' : 'Mời Admin mới'}
      okText={editing ? 'Lưu và gửi lại' : 'Gửi lời mời'}
      cancelText="Hủy"
      confirmLoading={loading}
      onCancel={onClose}
      onOk={onSave}
      destroyOnHidden
    >
      <Alert
        className="mb-5"
        type="info"
        showIcon
        title="Tài khoản chỉ được kích hoạt sau khi người nhận đặt mật khẩu"
        description="Email xác minh, MFA email và mã dự phòng sẽ được thiết lập trong cùng một luồng."
      />
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="full_name"
            label="Họ và tên"
            rules={[
              { required: true, message: 'Nhập họ tên người được mời.' },
              { min: 2, message: 'Họ tên cần ít nhất 2 ký tự.' },
            ]}
          >
            <Input disabled={editing} autoFocus={!editing} placeholder="Nguyễn Văn An" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email công việc"
            rules={[
              { required: true, message: 'Nhập email.' },
              { type: 'email', message: 'Email chưa đúng định dạng.' },
            ]}
          >
            <Input disabled={editing} placeholder="an.nguyen@company.vn" />
          </Form.Item>
        </div>
        <Form.Item
          name="target_role_public_id"
          label="Chức danh được cấp"
          rules={[{ required: true, message: 'Chọn chức danh.' }]}
          extra="Danh sách này do backend trả về theo whitelist của chức danh hiện tại."
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn chức danh phù hợp"
            options={roles.map((role) => ({
              value: role.public_id,
              label: `${role.department.name} · ${role.name}`,
            }))}
          />
        </Form.Item>
        <RoleSummary role={selectedRole} />
        <Form.Item
          name="reason"
          label="Lý do cấp tài khoản"
          rules={[
            { required: true, message: 'Nhập lý do cấp tài khoản.' },
            { max: 500, message: 'Lý do tối đa 500 ký tự.' },
          ]}
        >
          <Input.TextArea
            rows={3}
            showCount
            maxLength={500}
            placeholder="Ví dụ: Bổ sung nhân sự kiểm duyệt cho ca tối..."
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function InvitationPanel({ departments, roles: allRoles, isSuperuser }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    department: '',
    role: '',
    invited_by: '',
    page: 1,
  })
  const deferredSearch = useDeferredValue(filters.q.trim())
  const params = useMemo(() => ({
    ...filters,
    q: deferredSearch,
  }), [deferredSearch, filters])
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')

  const invitationsQuery = useQuery({
    queryKey: adminAccountKeys.invitations(params),
    queryFn: ({ signal }) => getAdminInvitations(params, { signal }),
  })
  const rolesQuery = useQuery({
    queryKey: adminAccountKeys.availableRoles,
    queryFn: ({ signal }) => getAvailableAdminInvitationRoles({ signal }),
  })
  const invitations = useMemo(
    () => invitationsQuery.data?.results || [],
    [invitationsQuery.data?.results],
  )
  const availableRoles = rolesQuery.data || []
  const inviters = useMemo(() => Array.from(
    new Map(invitations.map((item) => [item.invited_by.public_id, item.invited_by])).values(),
  ), [invitations])

  const patchFilter = (key, value) => setFilters((current) => ({
    ...current,
    [key]: value,
    page: key === 'page' ? value : 1,
  }))

  const openEditor = (invitation = null) => {
    form.setFieldsValue(invitation ? {
      full_name: invitation.user.full_name,
      email: invitation.user.email,
      target_role_public_id: invitation.target_role.public_id,
      reason: invitation.reason,
    } : {
      full_name: '',
      email: '',
      target_role_public_id: availableRoles[0]?.public_id,
      reason: '',
    })
    setEditor({ invitation })
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editor.invitation) {
        await updateAdminInvitation(editor.invitation.public_id, {
          target_role_public_id: values.target_role_public_id,
          reason: values.reason,
        })
        message.success('Đã cập nhật chức danh và làm mới liên kết mời.')
      } else {
        await createAdminInvitation(values)
        message.success('Đã tạo lời mời Admin.')
      }
      setEditor(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, 'Không thể lưu lời mời.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const resend = async (invitation) => {
    try {
      await resendAdminInvitation(invitation.public_id)
      message.success('Đã làm mới và gửi lại liên kết mời.')
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể gửi lại lời mời.'))
    }
  }

  const revoke = async () => {
    if (!revokeReason.trim()) {
      message.warning('Vui lòng nhập lý do thu hồi.')
      return
    }
    setSaving(true)
    try {
      await revokeAdminInvitation(revoking.public_id, revokeReason)
      message.success('Đã thu hồi lời mời.')
      setRevoking(null)
      setRevokeReason('')
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể thu hồi lời mời.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Người được mời',
      key: 'user',
      width: 250,
      render: (_, row) => (
        <div className="min-w-0">
          <Typography.Text strong ellipsis className="!block">
            {row.user.full_name}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis className="!block !text-xs">
            {row.user.email}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Phòng ban / chức danh',
      key: 'role',
      width: 240,
      render: (_, row) => (
        <div>
          <strong className="block">{row.target_role.name}</strong>
          <span className="text-xs text-slate-500">{row.target_role.department.name}</span>
        </div>
      ),
    },
    {
      title: 'Người mời',
      key: 'inviter',
      width: 210,
      render: (_, row) => row.invited_by.full_name || row.invited_by.email,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 145,
      render: (value) => <InvitationStatusTag status={value} />,
    },
    {
      title: 'Thời hạn',
      dataIndex: 'expires_at',
      width: 155,
      render: (value) => formatAdminDate(value),
    },
    {
      title: 'Gửi gần nhất',
      dataIndex: 'updated_at',
      width: 155,
      render: (value) => formatAdminDate(value),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 138,
      render: (_, row) => row.status === 'pending' ? (
        <Space size={2}>
          <Tooltip title="Đổi chức danh">
            <Button
              type="text"
              aria-label="Đổi chức danh"
              icon={<EditOutlined />}
              onClick={() => openEditor(row)}
            />
          </Tooltip>
          <Popconfirm
            title="Gửi lại lời mời?"
            description="Liên kết cũ sẽ mất hiệu lực ngay."
            okText="Gửi lại"
            cancelText="Hủy"
            onConfirm={() => resend(row)}
          >
            <Tooltip title="Gửi lại lời mời">
              <Button type="text" aria-label="Gửi lại lời mời" icon={<ReloadOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Tooltip title="Thu hồi lời mời">
            <Button
              danger
              type="text"
              aria-label="Thu hồi lời mời"
              icon={<StopOutlined />}
              onClick={() => setRevoking(row)}
            />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div>
      <div className="account-list-toolbar">
        <div className="account-list-toolbar__filters">
          <Input
            allowClear
            prefix={<MailOutlined className="text-slate-400" />}
            placeholder="Tìm người được mời hoặc email"
            value={filters.q}
            onChange={(event) => patchFilter('q', event.target.value)}
          />
          <Select
            value={filters.status}
            onChange={(value) => patchFilter('status', value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'pending', label: 'Đang chờ' },
              { value: 'accepted', label: 'Đã chấp nhận' },
              { value: 'revoked', label: 'Đã thu hồi' },
              { value: 'expired', label: 'Hết hạn' },
            ]}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Phòng ban"
            value={filters.department || undefined}
            onChange={(value) => patchFilter('department', value || '')}
            options={departments.map((item) => ({
              value: item.public_id,
              label: item.name,
            }))}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chức danh"
            value={filters.role || undefined}
            onChange={(value) => patchFilter('role', value || '')}
            options={allRoles.map((item) => ({
              value: item.public_id,
              label: `${item.department.name} · ${item.name}`,
            }))}
          />
          {isSuperuser && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Người mời"
              value={filters.invited_by || undefined}
              onChange={(value) => patchFilter('invited_by', value || '')}
              options={inviters.map((item) => ({
                value: item.public_id,
                label: item.full_name || item.email,
              }))}
            />
          )}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!availableRoles.length}
          loading={rolesQuery.isLoading}
          onClick={() => openEditor()}
        >
          Mời Admin
        </Button>
      </div>

      {!rolesQuery.isLoading && availableRoles.length === 0 && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title="Chưa có chức danh nào bạn được phép mời"
          description={isSuperuser
            ? 'Hãy tạo một chức danh hoạt động có quyền trước khi gửi lời mời.'
            : 'Superuser cần thêm quy tắc mời Admin cho chức danh của bạn.'}
        />
      )}

      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={invitationsQuery.isLoading}
          dataSource={invitations}
          columns={columns}
          scroll={{ x: 1250 }}
          pagination={{
            current: filters.page,
            total: invitationsQuery.data?.count || 0,
            pageSize: 20,
            showSizeChanger: false,
            onChange: (page) => patchFilter('page', page),
            showTotal: (total) => `${total} lời mời`,
          }}
        />
      </div>

      <InvitationModal
        editor={editor}
        roles={availableRoles}
        loading={saving}
        form={form}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      <Modal
        open={Boolean(revoking)}
        title="Thu hồi lời mời Admin"
        okText="Thu hồi"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        confirmLoading={saving}
        onCancel={() => setRevoking(null)}
        onOk={revoke}
      >
        <Typography.Paragraph type="secondary">
          Liên kết đang gửi cho <strong>{revoking?.user.email}</strong> sẽ mất hiệu lực ngay.
        </Typography.Paragraph>
        <label className="account-modal-field">
          <span>Lý do thu hồi</span>
          <Input.TextArea
            autoFocus
            rows={3}
            showCount
            maxLength={500}
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
            placeholder="Nhập lý do để lưu vào audit..."
          />
        </label>
      </Modal>
    </div>
  )
}
