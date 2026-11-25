import { Divider } from 'antd'
import { useSearchParams } from 'react-router'
import { getReturnUrl, startOAuthReauth } from '@/features/common/account/auth'
import { ChangePasswordForm } from '@/features/common/account/change-password'
import { SessionManager } from '@/features/common/account/session-management'
import { DataRequestsPanel } from '@/features/common/privacy/data-requests'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerPasswordLogin() {
  const [searchParams] = useSearchParams()
  const requestedReturnUrl = getReturnUrl(searchParams)
  const successRedirect = requestedReturnUrl === EMPLOYER_PHONE_VERIFY_URL
    ? requestedReturnUrl
    : undefined

  return (
    <EmployerAccountSettingsShell
      title={m.employer_account_page_password_title()}
      description={m.employer_account_page_password_desc()}
    >
      <ChangePasswordForm successRedirect={successRedirect} onReauth={startOAuthReauth} />
      <Divider className="!my-8" />
      <SessionManager />
      <Divider className="!my-8" />
      <DataRequestsPanel />
    </EmployerAccountSettingsShell>
  )
}
