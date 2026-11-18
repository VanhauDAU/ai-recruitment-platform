import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Descriptions, Drawer, Typography } from 'antd'
import {
  accountSubtitle,
  formatAdminDate,
} from '@/entities/account/admin-account'
import { AccountRoleTag, AccountStatusTag } from './AccountStatusTag'

function DetailLine({ icon, label, value }) {
  return (
    <div className="account-drawer__line">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p>{label}</p>
        <strong className="break-words">{value}</strong>
      </div>
    </div>
  )
}

export default function AccountQuickDrawer({ account, open, onClose, onOpenDetail }) {
  if (!account) return null

  return (
    <Drawer
      open={open}
      size="min(480px, 100vw)"
      push={false}
      destroyOnHidden
      title="Thông tin tài khoản"
      onClose={onClose}
      extra={(
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={() => onOpenDetail(account)}
        >
          Chi tiết
        </Button>
      )}
    >
      <div className="account-drawer__hero">
        <Avatar size={64} src={account.avatar_url || undefined} icon={<UserOutlined />} />
        <div className="min-w-0">
          <Typography.Title level={4} ellipsis className="!mb-1">
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

      <div className="account-drawer__summary">
        <DetailLine icon={<UserOutlined />} label="Ngữ cảnh nghiệp vụ" value={accountSubtitle(account)} />
        <DetailLine
          icon={<SafetyCertificateOutlined />}
          label="Xác thực"
          value={account.email_verified ? 'Email đã xác minh' : 'Email chưa xác minh'}
        />
        <DetailLine
          icon={<ClockCircleOutlined />}
          label="Hoạt động gần nhất"
          value={formatAdminDate(account.last_activity_at || account.last_login)}
        />
      </div>

      <Descriptions className="mt-5" size="small" column={1} bordered>
        <Descriptions.Item label="Số điện thoại">
          {account.phone || 'Chưa cập nhật'}
        </Descriptions.Item>
        <Descriptions.Item label="Phiên hoạt động">
          {account.active_session_count}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {formatAdminDate(account.date_joined)}
        </Descriptions.Item>
        <Descriptions.Item label="Mã tài khoản">
          <Typography.Text copyable code>{account.public_id}</Typography.Text>
        </Descriptions.Item>
      </Descriptions>

    </Drawer>
  )
}
