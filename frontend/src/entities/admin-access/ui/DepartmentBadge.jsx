import { Tag } from 'antd'

export default function DepartmentBadge({ primaryDepartment, memberships = [] }) {
  if (!primaryDepartment) return null
  const primaryMembership = memberships.find(
    (membership) => membership.department.code === primaryDepartment.code,
  )
  const label = primaryMembership?.role?.name
    ? `${primaryDepartment.name} · ${primaryMembership.role.name}`
    : primaryDepartment.name
  return <Tag color="green">{label}</Tag>
}
