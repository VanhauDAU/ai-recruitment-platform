import {
  EmployerAccountInformation,
  EmployerAccountSettingsShell,
  EmployerAccountVerificationCard,
} from '@/widgets/employer/account-settings'
import { EmployerCompanyDomainVerification } from '@/features/employer/account/verify-company-domain'
import { EmployerTrustBadgeEligibility } from '@/features/employer/account/verify-employer-account'
import { m } from '@/shared/config/i18n'

export default function EmployerAccountInformationPage() {
  return (
    <EmployerAccountSettingsShell
      title={m.employer_account_settings_nav_account()}
      description={m.employer_account_page_account_desc()}
    >
      <EmployerAccountVerificationCard />
      <EmployerTrustBadgeEligibility className="mb-5" />
      <EmployerCompanyDomainVerification className="mb-5" />
      <EmployerAccountInformation />
    </EmployerAccountSettingsShell>
  )
}
