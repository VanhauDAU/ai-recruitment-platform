const employerProfileRoot = ['employer']
const employerCompanyRoot = [...employerProfileRoot, 'company']

export const employerProfileKeys = {
  all: employerProfileRoot,
  profile: [...employerProfileRoot, 'profile'],
  company: employerCompanyRoot,
  companyDocuments: [...employerCompanyRoot, 'documents'],
}
