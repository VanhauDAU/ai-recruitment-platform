export const COMPANY_DIRECTORY_PATH = '/cong-ty'
export const COMPANY_SEARCH_PATH = '/cong-ty/tim-kiem'

function normalizedCompanyName(companyOrName) {
  if (typeof companyOrName === 'string') return companyOrName.trim()
  return (companyOrName?.company_name || companyOrName?.trade_name || '').trim()
}

export function companyDirectoryPath(companyOrName) {
  const companyName = normalizedCompanyName(companyOrName)
  if (!companyName) return COMPANY_DIRECTORY_PATH
  return companySearchPath(companyName)
}

export function companySearchPath(keyword) {
  const normalizedKeyword = String(keyword || '').trim()
  if (!normalizedKeyword) return COMPANY_SEARCH_PATH
  return `${COMPANY_SEARCH_PATH}?${new URLSearchParams({ keyword: normalizedKeyword })}`
}

export function companyJobsPath(companyOrName) {
  const companyName = normalizedCompanyName(companyOrName)
  if (!companyName) return '/viec-lam'
  return `/viec-lam?${new URLSearchParams({ search: companyName, search_by: 'company' })}`
}
