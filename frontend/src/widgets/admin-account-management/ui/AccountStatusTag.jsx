import { Badge, Tag } from 'antd'
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  INVITATION_STATUS_LABELS,
} from '@/entities/admin-account'

const STATUS_COLORS = {
  active: 'green',
  banned: 'red',
  inactive: 'orange',
  pending: 'blue',
}

const INVITATION_COLORS = {
  accepted: 'green',
  expired: 'default',
  pending: 'processing',
  revoked: 'red',
}

export function AccountStatusTag({ status }) {
  return (
    <Tag color={STATUS_COLORS[status] || 'default'} variant="filled">
      {ACCOUNT_STATUS_LABELS[status] || status}
    </Tag>
  )
}

export function AccountRoleTag({ role }) {
  const colors = { admin: 'purple', candidate: 'cyan', employer: 'geekblue' }
  return (
    <Tag color={colors[role] || 'default'} variant="filled">
      {ACCOUNT_ROLE_LABELS[role] || role}
    </Tag>
  )
}

export function InvitationStatusTag({ status }) {
  return (
    <Badge
      status={INVITATION_COLORS[status] || 'default'}
      text={INVITATION_STATUS_LABELS[status] || status}
    />
  )
}
