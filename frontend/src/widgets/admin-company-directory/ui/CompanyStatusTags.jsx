import { Tag } from 'antd'
import {
  companyVerificationMeta,
  recruiterVerificationMeta,
} from '@/entities/admin-company'

export function CompanyStatusTag({ status }) {
  const meta = companyVerificationMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function RecruiterStatusTag({ status }) {
  const meta = recruiterVerificationMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}
