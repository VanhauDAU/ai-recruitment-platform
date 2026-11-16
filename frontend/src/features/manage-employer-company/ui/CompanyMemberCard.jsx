import {
  CalendarOutlined,
  CrownFilled,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  MailOutlined,
  MoreOutlined,
  PhoneOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Input, Modal, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { formatDateTime } from '@/shared/lib/date-time'

const VERIFICATION_COLORS = {
  approved: 'success',
  pending: 'processing',
  in_review: 'processing',
  changes_requested: 'warning',
  rejected: 'error',
  revoked: 'error',
  expired: 'default',
}

function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'NT'
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words.at(-1)[0]}`).toLocaleUpperCase('vi-VN')
}

const STATS = [
  ['active_job_count', 'tin đang tuyển', 'green', <RocketOutlined key="i" />],
  ['unanswered_application_count', 'hồ sơ chờ phản hồi', 'amber', <FileSearchOutlined key="i" />],
  ['open_campaign_count', 'chiến dịch đang mở', 'blue', <CalendarOutlined key="i" />],
]

function RecruitingActivity({ member }) {
  const stats = STATS.filter(([field]) => member[field] > 0)
  if (!stats.length) return <p className="company-member__stats--empty">Chưa có hoạt động tuyển dụng</p>
  return (
    <div className="company-member__stats">
      {stats.map(([field, label, tone, icon]) => (
        <span key={field} className={`company-member__stat company-member__stat--${tone}`}>
          {icon}<strong>{member[field]}</strong> {label}
        </span>
      ))}
    </div>
  )
}

/** One member as the company manager sees it, with every action in one menu. */
export default function CompanyMemberCard({ member, busy, onTransfer, onToggleEditor, onRemove }) {
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')
  const manager = member.role === 'manager'
  const blocked = member.removal_blockers.length > 0

  const items = manager ? [] : [
    {
      key: 'editor',
      icon: member.page_editor_grant_id ? <StopOutlined /> : <EditOutlined />,
      label: member.page_editor_grant_id ? 'Thu hồi quyền biên tập trang công ty' : 'Cấp quyền biên tập trang công ty',
      disabled: !member.page_editor_grant_id && !member.can_grant_page_editor,
    },
    {
      key: 'transfer',
      icon: <SwapOutlined />,
      label: member.can_transfer ? 'Chuyển quyền quản lý công ty' : (
        <Tooltip title="Chỉ chuyển được cho thành viên đã xác thực tài khoản">Chuyển quyền quản lý công ty</Tooltip>
      ),
      disabled: !member.can_transfer,
    },
    { type: 'divider' },
    {
      key: 'remove',
      icon: <DeleteOutlined />,
      danger: true,
      label: blocked ? <Tooltip title={`Chưa thể gỡ: ${member.removal_blockers.join(', ')}`}>Gỡ khỏi công ty</Tooltip> : 'Gỡ khỏi công ty',
      disabled: blocked,
    },
  ]

  const onMenu = ({ key }) => {
    if (key === 'editor') onToggleEditor(member)
    if (key === 'transfer') onTransfer(member)
    if (key === 'remove') setRemoving(true)
  }

  return (
    <article className={`company-member${manager ? ' company-member--manager' : ''}`}>
      <Avatar size={48} src={member.avatar_url || undefined} className="company-member__avatar">
        {!member.avatar_url && initials(member.display_name)}
      </Avatar>
      <div className="company-member__body">
        <div className="company-member__head">
          <strong className="company-member__name">{member.display_name}</strong>
          {member.is_me && <span className="company-member__me">Bạn</span>}
          <Tag className="company-member__role" color={manager ? 'gold' : 'default'} icon={manager ? <CrownFilled /> : null}>
            {member.role_label}
          </Tag>
          <Tag color={VERIFICATION_COLORS[member.verification_status] || 'default'} icon={<SafetyCertificateOutlined />}>
            {member.verification_label}
          </Tag>
          {member.page_editor_grant_id && <Tag color="cyan" icon={<EditOutlined />}>Biên tập trang công ty</Tag>}
          {member.has_compliance_hold && <Tag color="red">Đang bị giữ tuân thủ</Tag>}
        </div>
        {member.position_title && <p className="company-member__title">{member.position_title}</p>}
        <p className="company-member__contact">
          {member.email_masked && <span><MailOutlined /> {member.email_masked}</span>}
          {member.phone_masked && <span><PhoneOutlined /> {member.phone_masked}</span>}
          {member.joined_at && (
            <span>
              <CalendarOutlined /> Tham gia {formatDateTime(member.joined_at)}
              {member.approved_by_name && ` · duyệt bởi ${member.approved_by_name}`}
            </span>
          )}
        </p>
        <RecruitingActivity member={member} />
      </div>
      {!manager && (
        <Dropdown menu={{ items, onClick: onMenu }} trigger={['click']} placement="bottomRight">
          <Button className="company-member__menu" icon={<MoreOutlined />} loading={busy} aria-label={`Quản lý ${member.display_name}`}>
            Quản lý
          </Button>
        </Dropdown>
      )}
      <Modal
        open={removing}
        title={`Gỡ ${member.display_name} khỏi công ty?`}
        okText="Gỡ khỏi công ty"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: busy }}
        onOk={async () => {
          // The error is already shown; keep the dialog open to retry.
          if (await onRemove(member, reason.trim()).then(() => true, () => false)) setRemoving(false)
        }}
        onCancel={() => setRemoving(false)}
        destroyOnHidden
      >
        <p className="mb-2 text-sm text-slate-600">
          Thành viên mất quyền truy cập dữ liệu công ty, quyền biên tập trang (nếu có) và phải xác thực lại nếu tham gia công ty khác. Thành viên sẽ nhận thông báo.
        </p>
        <Input.TextArea aria-label="Lý do gỡ thành viên" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: đã nghỉ việc tại công ty" />
      </Modal>
    </article>
  )
}
