import { m } from '@/shared/config/i18n'

export function companyDisplayName(company) {
  return (company?.trade_name || company?.company_name || m.company_fallback_name()).trim() || m.company_fallback_name()
}

export function companyInitial(company) {
  return companyDisplayName(company).charAt(0).toLocaleUpperCase('vi') || 'C'
}
