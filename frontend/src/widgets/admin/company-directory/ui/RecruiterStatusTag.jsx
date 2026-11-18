import { Tag } from 'antd'
import { recruiterVerificationMeta } from '@/entities/company/admin-company'

export default function RecruiterStatusTag({ status }) {
  const meta = recruiterVerificationMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}
