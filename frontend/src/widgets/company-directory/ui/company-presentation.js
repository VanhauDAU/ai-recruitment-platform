export function companyDisplayName(company) {
  return (company?.trade_name || company?.company_name || 'Công ty').trim() || 'Công ty'
}

export function companyInitial(company) {
  return companyDisplayName(company).charAt(0).toLocaleUpperCase('vi') || 'C'
}
