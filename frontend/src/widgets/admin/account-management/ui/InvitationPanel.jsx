import {
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
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  adminAccountKeys,
  createAdminInvitation,
  formatAdminDate,
  getAdminInvitations,
  resendAdminInvitation,
  revokeAdminInvitation,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import { InvitationStatusTag } from './AccountStatusTag'

const INVITATION_QUERY_KEYS = {
  q: 'invite_q',
  status: 'invite_status',
  invited_by: 'invite_by',
  page: 'invite_page',
  ordering: 'invite_ordering',
}

function invitationFiltersFromQuery(searchParams) {
  const page = Number(searchParams.get(INVITATION_QUERY_KEYS.page) || 1)
  return {
    q: searchParams.get(INVITATION_QUERY_KEYS.q) || '',
    status: searchParams.get(INVITATION_QUERY_KEYS.status) || '',
    invited_by: searchParams.get(INVITATION_QUERY_KEYS.invited_by) || '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    ordering: searchParams.get(INVITATION_QUERY_KEYS.ordering) || '-created_at',
  }
}

function InvitationModal({ open, loading, form, onClose, onSave }) {
  return (
    <Modal
      open={open}
      width={680}
      title="Mời Admin mới"
      okText="Gửi lời mời"
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
        description="Người nhận mở liên kết mời để xác minh email và đặt mật khẩu trong cùng một luồng."
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
            <Input autoFocus placeholder="Nguyễn Văn An" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email công việc"
            rules={[
              { required: true, message: 'Nhập email.' },
              { type: 'email', message: 'Email chưa đúng định dạng.' },
            ]}
          >
            <Input placeholder="an.nguyen@company.vn" />
          </Form.Item>
        </div>
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

export default function InvitationPanel() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const filters = useMemo(
    () => invitationFiltersFromQuery(searchParams),
    [searchParams],
  )
  const deferredSearch = useDeferredValue(filters.q.trim())
  const params = useMemo(() => ({
    ...filters,
    q: deferredSearch,
  }), [deferredSearch, filters])
  const [inviting, setInviting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')

  const invitationsQuery = useQuery({
    queryKey: adminAccountKeys.invitations(params),
    queryFn: ({ signal }) => getAdminInvitations(params, { signal }),
  })
  const invitations = useMemo(
    () => invitationsQuery.data?.results || [],
    [invitationsQuery.data?.results],
  )
  const inviters = useMemo(() => Array.from(
    new Map(invitations.map((item) => [item.invited_by.public_id, item.invited_by])).values(),
  ), [invitations])

  const patchFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    const queryKey = INVITATION_QUERY_KEYS[key]
    const defaultValue = key === 'ordering' ? '-created_at' : ''
    if (value === defaultValue || value === '' || value == null || (key === 'page' && value === 1)) {
      next.delete(queryKey)
    } else {
      next.set(queryKey, String(value))
    }
    if (key !== 'page') next.delete(INVITATION_QUERY_KEYS.page)
    setSearchParams(next)
  }

  const openInvite = () => {
    form.resetFields()
    setInviting(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await createAdminInvitation(values)
      message.success('Đã tạo lời mời Admin.')
      setInviting(false)
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
      throw error
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

  const sortOrderOf = (key) => {
    if (filters.ordering === key) return 'ascend'
    return filters.ordering === `-${key}` ? 'descend' : null
  }

  const columns = [
    {
      title: 'Người được mời',
      key: 'user__full_name',
      width: 250,
      sorter: true,
      sortOrder: sortOrderOf('user__full_name'),
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
      title: 'Người mời',
      key: 'invited_by__full_name',
      width: 210,
      sorter: true,
      sortOrder: sortOrderOf('invited_by__full_name'),
      render: (_, row) => row.invited_by.full_name || row.invited_by.email,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 145,
      sorter: true,
      sortOrder: sortOrderOf('status'),
      render: (value) => <InvitationStatusTag status={value} />,
    },
    {
      title: 'Thời hạn',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 155,
      sorter: true,
      sortOrder: sortOrderOf('expires_at'),
      render: (value) => formatAdminDate(value),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 155,
      sorter: true,
      sortOrder: sortOrderOf('created_at'),
      render: (value) => formatAdminDate(value),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 96,
      render: (_, row) => row.status === 'pending' ? (
        <Space size={2}>
          <ConfirmAction
            title="Gửi lại lời mời"
            description={<>Bạn có chắc muốn gửi lại lời mời tới <strong>{row.user.email}</strong>? Liên kết hiện tại sẽ mất hiệu lực và được thay bằng liên kết mới.</>}
            confirmText="Gửi lại"
            cancelText="Hủy"
            onConfirm={() => resend(row)}
          >
            <Tooltip title="Gửi lại lời mời">
              <Button type="text" aria-label="Gửi lại lời mời" icon={<ReloadOutlined />} />
            </Tooltip>
          </ConfirmAction>
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
            placeholder="Người mời"
            value={filters.invited_by || undefined}
            onChange={(value) => patchFilter('invited_by', value || '')}
            options={inviters.map((item) => ({
              value: item.public_id,
              label: item.full_name || item.email,
            }))}
          />
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openInvite}
        >
          Mời Admin
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={invitationsQuery.isLoading}
          dataSource={invitations}
          columns={columns}
          scroll={{ x: 1010 }}
          pagination={{
            current: filters.page,
            total: invitationsQuery.data?.count || 0,
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `${total} lời mời`,
          }}
          onChange={(pagination, _, sorter, extra) => {
            if (extra.action === 'sort') {
              const ordering = sorter.order
                ? `${sorter.order === 'descend' ? '-' : ''}${sorter.columnKey}`
                : '-created_at'
              patchFilter('ordering', ordering)
              return
            }
            patchFilter('page', pagination.current)
          }}
        />
      </div>

      <InvitationModal
        open={inviting}
        loading={saving}
        form={form}
        onClose={() => setInviting(false)}
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
