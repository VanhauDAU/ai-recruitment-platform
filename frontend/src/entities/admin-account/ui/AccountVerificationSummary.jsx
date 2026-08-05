import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  InfoCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Descriptions, Tag, Typography } from 'antd'
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  formatAdminDate,
} from '../model/presentation'

const ROLE_COLORS = {
  admin: 'gold',
  candidate: 'blue',
  employer: 'purple',
}

const STATUS_COLORS = {
  active: 'green',
  banned: 'red',
  inactive: 'orange',
  pending: 'gold',
}

function VerificationState({ active, activeLabel, inactiveLabel }) {
  return (
    <span className={active ? 'text-emerald-700' : 'text-amber-700'}>
      {active
        ? <CheckCircleFilled className="mr-1.5" />
        : <ExclamationCircleFilled className="mr-1.5" />}
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

export default function AccountVerificationSummary({ account }) {
  if (!account) return null

  const fullName = account.full_name || 'Chưa cập nhật họ tên'
  const roleLabel = ACCOUNT_ROLE_LABELS[account.role] || account.role || 'Chưa xác định'
  const statusLabel = ACCOUNT_STATUS_LABELS[account.status]
    || account.status
    || 'Chưa xác định'

  return (
    <section
      aria-label="Thông tin tài khoản cần đối chiếu"
      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            size={42}
            src={account.avatar_url}
            icon={<UserOutlined />}
            className="shrink-0 !bg-blue-50 !text-blue-600"
          />
          <div className="min-w-0">
            <Typography.Text strong className="block truncate !text-[15px]">
              {fullName}
            </Typography.Text>
            <Typography.Text type="secondary" className="block truncate !text-xs">
              Tài khoản cần xác minh trước khi thao tác
            </Typography.Text>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tag color={ROLE_COLORS[account.role]} className="!m-0">{roleLabel}</Tag>
          <Tag color={STATUS_COLORS[account.status]} className="!m-0">{statusLabel}</Tag>
        </div>
      </div>

      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2 }}
        className="account-verification-summary"
      >
        <Descriptions.Item label="Email hiện tại">
          <Typography.Text copyable className="break-all">
            {account.email || 'Chưa cập nhật'}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Số điện thoại">
          {account.phone || 'Chưa cập nhật / không có quyền xem'}
        </Descriptions.Item>
        <Descriptions.Item label="Mã tài khoản">
          <Typography.Text copyable code>{account.public_id || '—'}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {formatAdminDate(account.date_joined)}
        </Descriptions.Item>
        <Descriptions.Item label="Đăng nhập gần nhất">
          {formatAdminDate(account.last_login, 'Chưa từng đăng nhập')}
        </Descriptions.Item>
        <Descriptions.Item label="Xác minh email">
          <VerificationState
            active={account.email_verified}
            activeLabel="Đã xác minh"
            inactiveLabel="Chưa xác minh"
          />
        </Descriptions.Item>
        <Descriptions.Item label="MFA">
          <VerificationState
            active={account.two_factor_enabled}
            activeLabel="Đang bật"
            inactiveLabel="Chưa bật"
          />
        </Descriptions.Item>
        <Descriptions.Item label="Phiên đang hoạt động">
          {account.active_session_count ?? 'Chưa xác định'}
        </Descriptions.Item>
      </Descriptions>

      <div className="flex gap-2 border-t border-slate-200 bg-blue-50/60 px-4 py-2.5 text-xs leading-5 text-slate-600">
        <InfoCircleOutlined className="mt-0.5 shrink-0 text-blue-600" />
        <span>
          Yêu cầu người dùng tự cung cấp thông tin trước, rồi đối chiếu ít nhất
          hai mục trên hồ sơ. Không đọc sẵn dữ liệu để người yêu cầu xác nhận theo.
        </span>
      </div>
    </section>
  )
}
