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
  SendOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Input, Modal, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
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
  ['active_job_count', m.employer_company_member_stat_active_jobs, 'green', <RocketOutlined key="i" />],
  ['unanswered_application_count', m.employer_company_member_stat_unanswered, 'amber', <FileSearchOutlined key="i" />],
  ['open_campaign_count', m.employer_company_member_stat_campaigns, 'blue', <CalendarOutlined key="i" />],
]

function RecruitingActivity({ member }) {
  const stats = STATS.filter(([field]) => member[field] > 0)
  if (!stats.length) return <p className="company-member__stats--empty">{m.employer_company_member_no_activity()}</p>
  return (
    <div className="company-member__stats">
      {stats.map(([field, label, tone, icon]) => (
        <span key={field} className={`company-member__stat company-member__stat--${tone}`}>
          {icon}<strong>{member[field]}</strong> {label({ count: member[field] })}
        </span>
      ))}
    </div>
  )
}

/** One member as the company manager sees it, with every action in one menu. */
export default function CompanyMemberCard({ member, busy, onTransfer, onToggleEditor, onHandover, onRemove }) {
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')
  const manager = member.role === 'manager'
  const blocked = member.removal_blockers.length > 0
  const holdsWork = member.job_count > 0 || member.open_campaign_count > 0
  const handover = {
    key: 'handover',
    icon: <SendOutlined />,
    label: holdsWork ? m.employer_company_member_handover() : (
      <Tooltip title={m.employer_company_member_no_jobs()}>{m.employer_company_member_handover()}</Tooltip>
    ),
    disabled: !holdsWork,
  }

  const items = manager ? (holdsWork ? [handover] : []) : [
    {
      key: 'editor',
      icon: member.page_editor_grant_id ? <StopOutlined /> : <EditOutlined />,
      label: member.page_editor_grant_id ? m.employer_company_member_revoke_editor() : m.employer_company_member_grant_editor(),
      disabled: !member.page_editor_grant_id && !member.can_grant_page_editor,
    },
    {
      key: 'transfer',
      icon: <SwapOutlined />,
      label: member.can_transfer ? m.employer_company_member_transfer() : (
        <Tooltip title={m.employer_company_member_transfer_verified_only()}>{m.employer_company_member_transfer()}</Tooltip>
      ),
      disabled: !member.can_transfer,
    },
    handover,
    { type: 'divider' },
    {
      key: 'remove',
      icon: <DeleteOutlined />,
      danger: true,
      label: blocked ? <Tooltip title={m.employer_company_member_remove_blocked({ blockers: member.removal_blockers.join(', ') })}>{m.employer_company_member_remove()}</Tooltip> : m.employer_company_member_remove(),
      disabled: blocked,
    },
  ]

  const onMenu = ({ key }) => {
    if (key === 'editor') onToggleEditor(member)
    if (key === 'transfer') onTransfer(member)
    if (key === 'handover') onHandover(member)
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
          {member.is_me && <span className="company-member__me">{m.employer_company_member_me()}</span>}
          <Tag className="company-member__role" color={manager ? 'gold' : 'default'} icon={manager ? <CrownFilled /> : null}>
            {member.role_label}
          </Tag>
          <Tag color={VERIFICATION_COLORS[member.verification_status] || 'default'} icon={<SafetyCertificateOutlined />}>
            {member.verification_label}
          </Tag>
          {member.page_editor_grant_id && <Tag color="cyan" icon={<EditOutlined />}>{m.employer_company_member_editor_tag()}</Tag>}
          {member.has_compliance_hold && <Tag color="red">{m.employer_company_member_compliance_hold()}</Tag>}
        </div>
        {member.position_title && <p className="company-member__title">{member.position_title}</p>}
        <p className="company-member__contact">
          {member.email_masked && <span><MailOutlined /> {member.email_masked}</span>}
          {member.phone_masked && <span><PhoneOutlined /> {member.phone_masked}</span>}
          {member.joined_at && (
            <span>
              <CalendarOutlined /> {m.employer_company_member_joined({ date: formatDateTime(member.joined_at) })}
              {member.approved_by_name && ` · ${m.employer_company_member_approved_by({ name: member.approved_by_name })}`}
            </span>
          )}
        </p>
        <RecruitingActivity member={member} />
      </div>
      {items.length > 0 && (
        <Dropdown menu={{ items, onClick: onMenu }} trigger={['click']} placement="bottomRight">
          <Button className="company-member__menu" icon={<MoreOutlined />} loading={busy} aria-label={m.employer_company_member_manage_label({ name: member.display_name })}>
            {m.employer_company_member_manage()}
          </Button>
        </Dropdown>
      )}
      <Modal
        open={removing}
        title={m.employer_company_member_remove_title({ name: member.display_name })}
        okText={m.employer_company_member_remove()}
        cancelText={m.employer_company_close()}
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: busy }}
        onOk={async () => {
          // The error is already shown; keep the dialog open to retry.
          if (await onRemove(member, reason.trim()).then(() => true, () => false)) setRemoving(false)
        }}
        onCancel={() => setRemoving(false)}
        destroyOnHidden
      >
        <p className="mb-2 text-sm text-slate-600">
          {m.employer_company_member_remove_description()}
        </p>
        <Input.TextArea aria-label={m.employer_company_member_remove_reason()} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={m.employer_company_member_remove_reason_placeholder()} />
      </Modal>
    </article>
  )
}
