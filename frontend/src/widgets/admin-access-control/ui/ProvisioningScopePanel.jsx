import {
  CheckCircleOutlined,
  LinkOutlined,
  PlusOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import {
  adminAccountKeys,
  createProvisioningScope,
  getProvisioningScopeImpact,
  getProvisioningScopes,
  setProvisioningScopeStatus,
} from '@/entities/admin-account'
import {
  adminAccessKeys,
  getAdminRoles,
} from '@/entities/admin-access'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const SENSITIVE_CODES = new Set([
  'account.admin.invite',
  'account.admin.manage',
  'admin_access.manage_role',
  'admin_access.manage_staff',
])

export default function ProvisioningScopePanel() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [impact, setImpact] = useState(null)
  const rolesQuery = useQuery({
    queryKey: adminAccessKeys.roles(''),
    queryFn: ({ signal }) => getAdminRoles('', { signal }),
  })
  const scopesQuery = useQuery({
    queryKey: adminAccountKeys.provisioningScopes,
    queryFn: ({ signal }) => getProvisioningScopes({ signal }),
  })
  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data])
  const sourceRoles = useMemo(() => roles.filter((role) => (
    role.is_active && role.permission_codes.includes('account.admin.invite')
  )), [roles])
  const targetRoles = useMemo(() => roles.filter((role) => (
    role.is_active && !role.permission_codes.some((code) => SENSITIVE_CODES.has(code))
  )), [roles])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
  }

  const create = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await createProvisioningScope(values)
      message.success('Đã thêm phạm vi cấp tài khoản.')
      setEditorOpen(false)
      form.resetFields()
      await invalidate()
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, 'Không thể tạo phạm vi cấp tài khoản.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const previewStatus = async (scope, isActive) => {
    setImpact({ scope, isActive, loading: true })
    try {
      const preview = await getProvisioningScopeImpact(scope.public_id, isActive)
      setImpact({ scope, isActive, loading: false, preview })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải tác động.'))
      setImpact(null)
    }
  }

  const confirmStatus = async () => {
    setSaving(true)
    try {
      await setProvisioningScopeStatus(
        impact.scope.public_id,
        impact.isActive,
        impact.preview.impact_token,
      )
      message.success(impact.isActive ? 'Đã kích hoạt phạm vi.' : 'Đã thu hồi phạm vi.')
      setImpact(null)
      await invalidate()
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Dữ liệu đã thay đổi. Đang tải lại tác động.')
        await previewStatus(impact.scope, impact.isActive)
      } else {
        message.error(getApiErrorMessage(error, 'Không thể cập nhật phạm vi.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const roleCell = (role) => (
    <div>
      <Typography.Text strong className="!block">{role.name}</Typography.Text>
      <Typography.Text type="secondary" className="!text-xs">
        {role.department.name}
      </Typography.Text>
    </div>
  )

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <Typography.Title level={5} className="!mb-1">Ủy quyền cấp tài khoản Admin</Typography.Title>
          <Typography.Text type="secondary">
            Chọn chính xác chức danh nguồn được mời vào từng chức danh đích.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setEditorOpen(true)}
        >
          Thêm phạm vi
        </Button>
      </div>
      <Alert
        className="mb-4"
        showIcon
        type="info"
        title="Whitelist được kiểm tra lại ở mọi thao tác ghi"
        description="Rank không được dùng để suy luận quyền. Chức danh đích có quyền cấp phát hoặc quản trị đặc quyền luôn bị chặn với Admin thường."
      />
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={scopesQuery.isLoading}
          dataSource={scopesQuery.data || []}
          pagination={false}
          scroll={{ x: 900 }}
          columns={[
            { title: 'Chức danh được cấp phát', dataIndex: 'source_role', render: roleCell },
            {
              title: '',
              width: 60,
              align: 'center',
              render: () => <LinkOutlined className="text-slate-400" />,
            },
            { title: 'Chức danh được phép cấp', dataIndex: 'target_role', render: roleCell },
            {
              title: 'Lời mời đang chờ',
              dataIndex: 'pending_invitation_count',
              width: 165,
              render: (value) => (
                <Tag color={value ? 'orange' : 'default'}>{`${value} lời mời`}</Tag>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              width: 130,
              render: (value) => (
                <Tag color={value ? 'green' : 'default'}>
                  {value ? 'Đang bật' : 'Đã tắt'}
                </Tag>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 70,
              render: (_, scope) => (
                <Tooltip title={scope.is_active ? 'Thu hồi phạm vi' : 'Kích hoạt phạm vi'}>
                  <Button
                    type="text"
                    danger={scope.is_active}
                    aria-label={scope.is_active ? 'Thu hồi phạm vi' : 'Kích hoạt phạm vi'}
                    icon={scope.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    onClick={() => previewStatus(scope, !scope.is_active)}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={editorOpen}
        title="Thêm phạm vi cấp tài khoản"
        okText="Thêm phạm vi"
        cancelText="Hủy"
        confirmLoading={saving}
        onCancel={() => setEditorOpen(false)}
        onOk={create}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="source_role_public_id"
            label="Chức danh được quyền cấp"
            rules={[{ required: true, message: 'Chọn chức danh nguồn.' }]}
            extra="Chỉ hiển thị chức danh có quyền account.admin.invite."
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn chức danh nguồn"
              options={sourceRoles.map((role) => ({
                value: role.public_id,
                label: `${role.department.name} · ${role.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="target_role_public_id"
            label="Chức danh được phép cấp"
            rules={[{ required: true, message: 'Chọn chức danh đích.' }]}
            extra="Chức danh nhạy cảm được loại khỏi danh sách và vẫn bị backend chặn."
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn chức danh đích"
              options={targetRoles.map((role) => ({
                value: role.public_id,
                label: `${role.department.name} · ${role.name}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(impact)}
        title={impact?.isActive ? 'Kích hoạt phạm vi cấp tài khoản' : 'Thu hồi phạm vi cấp tài khoản'}
        okText={impact?.isActive ? 'Kích hoạt' : 'Thu hồi phạm vi'}
        okButtonProps={{ danger: !impact?.isActive }}
        cancelText="Hủy"
        loading={impact?.loading}
        confirmLoading={saving}
        onCancel={() => setImpact(null)}
        onOk={confirmStatus}
      >
        {impact?.preview && (
          <div className="space-y-4">
            {!impact.isActive && impact.preview.pending_invitation_count > 0 && (
              <Alert
                showIcon
                icon={<WarningOutlined />}
                type="warning"
                title={`${impact.preview.pending_invitation_count} lời mời đang chờ sẽ bị thu hồi`}
                description="Các liên kết mời liên quan mất hiệu lực atomically khi xác nhận."
              />
            )}
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Chức danh nguồn">
                {impact.preview.target.source_role}
              </Descriptions.Item>
              <Descriptions.Item label="Chức danh đích">
                {impact.preview.target.target_role}
              </Descriptions.Item>
              <Descriptions.Item label="Lời mời bị ảnh hưởng">
                {impact.preview.pending_invitation_count}
              </Descriptions.Item>
            </Descriptions>
            {impact.preview.affected_accounts?.length > 0 && (
              <div>
                <Typography.Text strong>Tài khoản bị ảnh hưởng</Typography.Text>
                <ul className="mt-2 space-y-1 pl-5 text-sm text-slate-600">
                  {impact.preview.affected_accounts.map((account) => (
                    <li key={account.public_id}>{`${account.full_name} · ${account.email}`}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
