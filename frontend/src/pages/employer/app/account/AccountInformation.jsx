import {
  EmployerAccountInformation,
  EmployerAccountSettingsShell,
  EmployerAccountVerificationCard,
} from '@/widgets/employer-account-settings'
import { EmployerCompanyDomainVerification } from '@/features/verify-company-domain'
import { EmployerTrustBadgeEligibility } from '@/features/verify-employer-account'

export default function EmployerAccountInformationPage() {
  return (
    <EmployerAccountSettingsShell
      title="Thông tin tài khoản"
      description="Cập nhật thông tin liên hệ và quản lý hồ sơ tài khoản tuyển dụng của bạn."
    >
      <EmployerAccountVerificationCard />
      <EmployerTrustBadgeEligibility className="mb-5" />
      <EmployerCompanyDomainVerification className="mb-5" />
      <EmployerAccountInformation />
    </EmployerAccountSettingsShell>
  )
}
