export function logoUrlFor(employer) {
  return employer.company_logo_url?.trim() || ''
}

export function categoryLogoUrlFor(category) {
  return category.logo_url?.trim() || ''
}
