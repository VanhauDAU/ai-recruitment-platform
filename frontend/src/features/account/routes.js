// Public entrypoint dành riêng cho app router, giữ từng page account lazy.
export const loadAccountPlaceholderPage = () => import('./components/AccountPlaceholder')
export const loadCandidateAccountLayout = () => import('./pages/CandidateAccountLayout')
export const loadPersonalInfoPage = () => import('./pages/PersonalInfo')
