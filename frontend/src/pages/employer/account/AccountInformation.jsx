import { GlobalOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router'
import {
  EmployerAccountInformation,
  EmployerAccountSettingsShell,
  EmployerAccountVerificationCard,
} from '@/widgets/employer/account-settings'
import { EmployerCompanyDomainVerification } from '@/features/employer/account/verify-company-domain'
import { EmployerTrustBadgeEligibility } from '@/features/employer/account/verify-employer-account'
import { m } from '@/shared/config/i18n'
import FolderTabs from '@/shared/ui/folder-tabs/FolderTabs'

const TABS = [
  { key: 'account', icon: <UserOutlined />, label: m.employer_account_tab_account(), children: <EmployerAccountInformation /> },
  {
    key: 'verification',
    icon: <SafetyCertificateOutlined />,
    label: m.employer_account_tab_verification(),
    children: (
      <>
        <EmployerAccountVerificationCard />
        <EmployerTrustBadgeEligibility />
      </>
    ),
  },
  { key: 'domain', icon: <GlobalOutlined />, label: m.employer_account_tab_domain(), children: <EmployerCompanyDomainVerification /> },
]

// Thông tin tài khoản NTD chia tab; `?tab=` giữ tab đang mở khi tải lại hoặc gửi link.
export default function EmployerAccountInformationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeKey = TABS.some((tab) => tab.key === requested) ? requested : 'account'
  const selectTab = (key) => setSearchParams(key === 'account' ? {} : { tab: key }, { replace: true })

  return (
    <EmployerAccountSettingsShell
      title={m.employer_account_settings_nav_account()}
      description={m.employer_account_page_account_desc()}
    >
      <FolderTabs
        idPrefix="account-info"
        ariaLabel={m.employer_account_tabs_aria()}
        activeKey={activeKey}
        onChange={selectTab}
        plain
        items={TABS}
      />
    </EmployerAccountSettingsShell>
  )
}
