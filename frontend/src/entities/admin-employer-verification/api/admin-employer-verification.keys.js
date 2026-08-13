const root = ['admin-employer-verifications']

export const adminEmployerVerificationKeys = {
  all: root,
  summary: [...root, 'summary'],
  list: (params = {}) => [...root, 'list', params],
  detail: (publicId) => [...root, 'detail', publicId],
  document: (casePublicId, documentPublicId) => [
    ...root,
    'document',
    casePublicId,
    documentPublicId,
  ],
  companyUpdates: (params = {}) => [...root, 'company-updates', params],
  companyUpdate: (publicId) => [...root, 'company-update', publicId],
}

const domainClaimsRoot = ['admin-company-domain-claims']

export const adminCompanyDomainClaimKeys = {
  all: domainClaimsRoot,
  summary: [...domainClaimsRoot, 'summary'],
  list: (params = {}) => [...domainClaimsRoot, 'list', params],
  detail: (publicId) => [...domainClaimsRoot, 'detail', publicId],
}
