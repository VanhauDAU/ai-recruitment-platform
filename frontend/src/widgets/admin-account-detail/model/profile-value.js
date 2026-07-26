import { formatAdminDate } from '@/entities/admin-account'
import { companyValueLabel } from '@/entities/employer-profile'

export const isProfileValueEmpty = (value) => (
  value === null || value === undefined || value === ''
  || (Array.isArray(value) && value.length === 0)
)

export function displayProfileValue(field, value) {
  if (isProfileValueEmpty(value)) return 'Chưa cập nhật'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) {
    return value
      .map((item) => companyValueLabel(field, item?.name || item))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatAdminDate(value)
  }
  return String(companyValueLabel(field, value))
}
