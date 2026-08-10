const employerProfileRoot = ['employer']
const employerCompanyRoot = [...employerProfileRoot, 'company']
const employerCompanyUpdateRequestsRoot = [...employerCompanyRoot, 'update-requests']

export const employerProfileKeys = {
  all: employerProfileRoot,
  profile: [...employerProfileRoot, 'profile'],
  phoneChallenges: [...employerProfileRoot, 'phone-challenges'],
  phoneChallenge: (publicId) => [...employerProfileRoot, 'phone-challenges', publicId],
  company: employerCompanyRoot,
  companyDocuments: [...employerCompanyRoot, 'documents'],
  companyDocumentList: (scope) => [...employerCompanyRoot, 'documents', { scope }],
  companyUpdateRequests: employerCompanyUpdateRequestsRoot,
  companyUpdateRequestList: (scope) => [...employerCompanyUpdateRequestsRoot, { scope }],
}
