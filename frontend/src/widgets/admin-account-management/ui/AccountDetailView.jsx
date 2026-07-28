import {
  ArrowLeftOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  adminAccountKeys,
  changeAccountStatus,
  formatAdminDate,
  getAccountSessionsImpact,
  getAccountStatusImpact,
  getAdminAccount,
  getAdminAccountActivity,
  getAdminAccountSessions,
  resendAdminAccountVerification,
  revokeAccountSessions,
  updateAdminAccount,
} from '@/entities/admin-account'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { SendAccountPasswordResetButton } from '@/features/send-account-password-reset'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import AccountEditModal from './AccountEditModal'
import { AccountRoleTag, AccountStatusTag } from './AccountStatusTag'
import '../admin-account-management.css'

function humanize(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.join(', ') || 'Chưa cập nhật'
  if (typeof value === 'object') return null
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return formatAdminDate(value)
  return String(value)
}

function ProfileSection({ profile }) {
  if (!profile) return <Empty description="Chưa có hồ sơ nghiệp vụ" />
  const entries = Object.entries(profile).filter(([, value]) => typeof value !== 'object')
  const nested = Object.entries(profile).filter(([, value]) => (
    value && typeof value === 'object' && !Array.isArray(value)
  ))
  return (
    <div className="space-y-5">
      <Card title="Hồ sơ nghiệp vụ" className="account-detail-card">
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          {entries.map(([key, value]) => (
            <Descriptions.Item key={key} label={humanize(key)}>
              {displayValue(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
      {nested.map(([key, value]) => (
        <Card key={key} title={humanize(key)} className="account-detail-card">
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            {Object.entries(value).map(([childKey, childValue]) => (
              <Descriptions.Item key={childKey} label={humanize(childKey)}>
                {displayValue(childValue)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      ))}
    </div>
  )
}

function AccessSection({ account }) {
  const membership = account.admin_access?.membership
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Danh tính & xác thực" className="account-detail-card">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Email">
            <Space wrap>
              {account.email}
              <Tag color={account.email_verified ? 'green' : 'orange'}>
                {account.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Mật khẩu">
            {account.has_usable_password ? 'Đã thiết lập' : 'Chưa thiết lập'}
          </Descriptions.Item>
          <Descriptions.Item label="MFA email">
            {account.mfa_methods.email ? 'Đang bật' : 'Chưa bật'}
          </Descriptions.Item>
          <Descriptions.Item label="MFA TOTP">
            {account.mfa_methods.totp ? 'Đang bật' : 'Chưa bật'}
          </Descriptions.Item>
          <Descriptions.Item label="Mã dự phòng còn lại">
            {account.mfa_methods.backup_codes_remaining}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Quyền truy cập hiệu lực" className="account-detail-card">
        {account.role !== 'admin' ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không áp dụng RBAC Admin" />
        ) : membership ? (
          <div>
            <Typography.Title level={5} className="!mb-1">
              {membership.role.name}
            </Typography.Title>
            <Typography.Text type="secondary">
              {membership.role.department.name}
            </Typography.Text>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {membership.role.permission_codes.map((code) => <Tag key={code}>{code}</Tag>)}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {`Được cấp ${formatAdminDate(membership.assigned_at)}${membership.assigned_by_email ? ` bởi ${membership.assigned_by_email}` : ''}.`}
            </p>
          </div>
        ) : (
          <Alert type="warning" showIcon title="Admin chưa có chức danh hiệu lực" />
        )}
      </Card>
    </div>
  )
}

function SessionsPanel({ publicId }) {
  const query = useQuery({
    queryKey: adminAccountKeys.sessions(publicId),
    queryFn: ({ signal }) => getAdminAccountSessions(publicId, { signal }),
  })
  return (
    <Table
      rowKey="id"
      loading={query.isLoading}
      dataSource={query.data || []}
      pagination={false}
      scroll={{ x: 780 }}
      columns={[
        { title: 'Thiết bị', dataIndex: 'device_label', render: (value) => value || 'Không xác định' },
        { title: 'Cổng', dataIndex: 'portal', render: humanize },
        { title: 'Phương thức', dataIndex: 'auth_method', render: humanize },
        { title: 'IP', dataIndex: 'ip_address', render: (value) => value || '—' },
        { title: 'Hoạt động gần nhất', dataIndex: 'last_seen_at', render: (value) => formatAdminDate(value) },
        {
          title: 'Trạng thái',
          key: 'status',
          render: (_, row) => (
            <Tag color={row.revoked_at ? 'default' : 'green'}>
              {row.revoked_at ? 'Đã thu hồi' : 'Hoạt động'}
            </Tag>
          ),
        },
      ]}
    />
  )
}

function ActivityPanel({ publicId }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: adminAccountKeys.activity(publicId, page),
    queryFn: ({ signal }) => getAdminAccountActivity(publicId, page, { signal }),
  })
  return (
    <Table
      rowKey="public_id"
      loading={query.isLoading}
      dataSource={query.data?.results || []}
      scroll={{ x: 800 }}
      pagination={{
        current: page,
        total: query.data?.count || 0,
        pageSize: 20,
        showSizeChanger: false,
        onChange: setPage,
      }}
      columns={[
        { title: 'Thời gian', dataIndex: 'created_at', width: 165, render: (value) => formatAdminDate(value) },
        { title: 'Hành động', dataIndex: 'action', width: 220, render: humanize },
        { title: 'Người thực hiện', dataIndex: 'actor_email', width: 220, render: (value, row) => value || row.actor_identifier || 'Hệ thống' },
        {
          title: 'Chi tiết',
          dataIndex: 'payload',
          render: (value) => (
            <Typography.Text code className="!whitespace-normal !break-all !text-xs">
              {JSON.stringify(value)}
            </Typography.Text>
          ),
        },
      ]}
    />
  )
}

function ImpactModal({
  operation,
  account,
  loading,
  onClose,
  onPreview,
  onConfirm,
}) {
  const [form] = Form.useForm()
  const isStatus = operation?.kind === 'status'
  const preview = operation?.preview
  return (
    <Modal
      open={Boolean(operation)}
      title={isStatus ? 'Thay đổi trạng thái tài khoản' : 'Thu hồi toàn bộ phiên'}
      okText={preview ? 'Xác nhận thực hiện' : 'Xem tác động'}
      okButtonProps={{ danger: preview && (operation.status !== 'active' || !isStatus) }}
      cancelText="Hủy"
      confirmLoading={loading}
      onCancel={onClose}
      onOk={async () => {
        if (preview) onConfirm()
        else onPreview(await form.validateFields())
      }}
      destroyOnHidden
    >
      {!preview ? (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            status: account.status === 'active' ? 'inactive' : 'active',
            reason: '',
          }}
        >
          {isStatus && (
            <Form.Item
              name="status"
              label="Trạng thái mới"
              rules={[{ required: true }]}
            >
              <Select options={[
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Tạm khóa' },
                { value: 'banned', label: 'Cấm tài khoản' },
              ]}
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[
              { required: true, message: 'Nhập lý do thao tác.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea rows={3} showCount maxLength={500} />
          </Form.Item>
        </Form>
      ) : (
        <div className="space-y-4">
          <Alert
            showIcon
            type={isStatus && operation.status === 'active' ? 'info' : 'warning'}
            title="Hãy kiểm tra tác động trước khi xác nhận"
            description={operation.reason}
          />
          <Descriptions bordered size="small" column={1}>
            {isStatus && (
              <>
                <Descriptions.Item label="Trạng thái hiện tại">
                  <AccountStatusTag status={account.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái mới">
                  <AccountStatusTag status={operation.status} />
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Phiên bị thu hồi">
              {preview.active_session_count}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}
    </Modal>
  )
}

export default function AccountDetailView({ publicId }) {
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editForm] = Form.useForm()
  const [editing, setEditing] = useState(false)
  const [impact, setImpact] = useState(null)
  const [saving, setSaving] = useState(false)
  const activeTab = searchParams.get('tab') || 'overview'
  const query = useQuery({
    queryKey: adminAccountKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminAccount(publicId, { signal }),
  })
  const account = query.data

  if (query.isLoading) return <Card loading className="min-h-96" />
  if (query.isError || !account) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải tài khoản"
        description={getApiErrorMessage(query.error)}
        action={<Button onClick={() => navigate(adminPath('/accounts'))}>Quay lại</Button>}
      />
    )
  }

  const canEdit = isSuperuser || (account.role !== 'admin' && has('account.profile.manage'))
  const canStatus = isSuperuser || (account.role !== 'admin' && has('account.status.manage'))
  const canSecurity = isSuperuser || (account.role !== 'admin' && has('account.security.manage'))
  const canResetPassword = canSecurity && account.status === 'active'

  const openEdit = () => {
    editForm.setFieldsValue({ full_name: account.full_name, phone: account.phone })
    setEditing(true)
  }

  const saveEdit = async () => {
    const values = await editForm.validateFields()
    setSaving(true)
    try {
      await updateAdminAccount(publicId, values)
      message.success('Đã cập nhật hồ sơ tài khoản.')
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (!error?.errorFields) message.error(getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const previewImpact = async (values) => {
    setSaving(true)
    try {
      const preview = impact.kind === 'status'
        ? await getAccountStatusImpact(publicId, values)
        : await getAccountSessionsImpact(publicId, values.reason)
      setImpact((current) => ({ ...current, ...values, preview }))
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải tác động.'))
    } finally {
      setSaving(false)
    }
  }

  const confirmImpact = async () => {
    setSaving(true)
    try {
      if (impact.kind === 'status') {
        await changeAccountStatus(
          publicId,
          { status: impact.status, reason: impact.reason },
          impact.preview.impact_token,
        )
        message.success('Đã cập nhật trạng thái tài khoản.')
      } else {
        await revokeAccountSessions(
          publicId,
          impact.reason,
          impact.preview.impact_token,
        )
        message.success('Đã thu hồi các phiên hoạt động.')
      }
      setImpact(null)
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Dữ liệu đã thay đổi. Đang tải lại tác động.')
        setImpact((current) => ({ ...current, preview: null }))
      } else {
        message.error(getApiErrorMessage(error, 'Không thể hoàn tất thao tác.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const sendVerificationEmail = async () => {
    setSaving(true)
    try {
      await resendAdminAccountVerification(publicId)
      message.success('Đã xếp lịch gửi email xác minh.')
    } catch (error) {
      message.error(getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const overview = (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Thông tin cơ bản" className="account-detail-card">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Họ và tên">{account.full_name || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Email">{account.email}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{account.phone || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Loại tài khoản"><AccountRoleTag role={account.role} /></Descriptions.Item>
          <Descriptions.Item label="Trạng thái"><AccountStatusTag status={account.status} /></Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatAdminDate(account.date_joined)}</Descriptions.Item>
          <Descriptions.Item label="Cập nhật gần nhất">{formatAdminDate(account.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="Mã tài khoản">
            <Typography.Text copyable code>{account.public_id}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Dấu hiệu hoạt động" className="account-detail-card">
        <div className="account-detail-metrics">
          <div><span>Đăng nhập gần nhất</span><strong>{formatAdminDate(account.last_login)}</strong></div>
          <div><span>Hoạt động gần nhất</span><strong>{formatAdminDate(account.last_activity_at)}</strong></div>
          <div><span>Phiên đang hoạt động</span><strong>{account.active_session_count}</strong></div>
          <div><span>Mã dự phòng còn lại</span><strong>{account.mfa_methods.backup_codes_remaining}</strong></div>
        </div>
      </Card>
    </div>
  )

  const security = (
    <div className="space-y-5">
      <AccessSection account={account} />
      {canSecurity && (
        <Card title="Hành động bảo mật" className="account-detail-card">
          <div className="account-security-actions">
            <Tooltip title={canResetPassword
              ? 'Gửi liên kết đặt lại mật khẩu theo đúng cổng tài khoản'
              : 'Chỉ có thể gửi liên kết cho tài khoản đang hoạt động'}>
              <span>
                <SendAccountPasswordResetButton
                  publicId={publicId}
                  accountEmail={account.email}
                  disabled={!canResetPassword}
                />
              </span>
            </Tooltip>
            {!account.email_verified && (
              <Button icon={<MailOutlined />} loading={saving} onClick={sendVerificationEmail}>
                Gửi lại xác minh
              </Button>
            )}
            <Button danger icon={<StopOutlined />} onClick={() => setImpact({ kind: 'sessions' })}>
              Thu hồi mọi phiên
            </Button>
          </div>
        </Card>
      )}
      <Card title="Danh sách phiên" className="account-detail-card">
        <SessionsPanel publicId={publicId} />
      </Card>
    </div>
  )

  return (
    <div className="space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(adminPath('/accounts'))}>
        Quay lại danh sách
      </Button>
      <section className="account-detail-hero">
        <div className="account-detail-hero__identity">
          <Avatar size={72} src={account.avatar_url || undefined} icon={<UserOutlined />} />
          <div className="min-w-0">
            <Typography.Title level={2} ellipsis className="!mb-1 !text-2xl">
              {account.full_name || 'Chưa cập nhật họ tên'}
            </Typography.Title>
            <Typography.Text type="secondary" ellipsis className="!block">
              {account.email}
            </Typography.Text>
            <div className="mt-3 flex flex-wrap gap-2">
              <AccountRoleTag role={account.role} />
              <AccountStatusTag status={account.status} />
            </div>
          </div>
        </div>
        <Space wrap>
          {canEdit && (
            <Tooltip title="Sửa họ tên và số điện thoại">
              <Button icon={<EditOutlined />} onClick={openEdit}>Sửa hồ sơ</Button>
            </Tooltip>
          )}
          {canStatus && (
            <Tooltip title="Khóa, mở khóa hoặc cấm tài khoản">
              <Button
                danger={account.status === 'active'}
                icon={account.status === 'active' ? <LockOutlined /> : <ReloadOutlined />}
                onClick={() => setImpact({ kind: 'status' })}
              >
                Đổi trạng thái
              </Button>
            </Tooltip>
          )}
        </Space>
      </section>

      <section className="admin-panel account-detail-tabs">
        <Tabs
          activeKey={activeTab}
          onChange={(tab) => setSearchParams({ tab })}
          items={[
            { key: 'overview', label: 'Tổng quan', children: overview },
            { key: 'profile', label: 'Hồ sơ nghiệp vụ', children: <ProfileSection profile={account.profile} /> },
            { key: 'security', label: 'Truy cập & bảo mật', children: security, icon: <SafetyCertificateOutlined /> },
            { key: 'activity', label: 'Hoạt động & audit', children: <ActivityPanel publicId={publicId} /> },
          ]}
        />
      </section>

      <AccountEditModal
        account={editing ? account : null}
        form={editForm}
        loading={saving}
        onClose={() => setEditing(false)}
        onSave={saveEdit}
      />
      <ImpactModal
        operation={impact}
        account={account}
        loading={saving}
        onClose={() => setImpact(null)}
        onPreview={previewImpact}
        onConfirm={confirmImpact}
      />
    </div>
  )
}
