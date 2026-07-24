const employerProfileRoot = ['employer']
const employerCompanyRoot = [...employerProfileRoot, 'company']

export const employerProfileKeys = {
  all: employerProfileRoot,
  company: employerCompanyRoot,
  companyDocuments: [...employerCompanyRoot, 'documents'],
}
