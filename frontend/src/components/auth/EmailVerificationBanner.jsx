import { WarningFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function EmailVerificationBanner({ verificationPath }) {
  const { user } = useAuth()
  if (!user || user.email_verified || user.provider !== 'local') return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm text-amber-800 dark:text-amber-200">
        <WarningFilled className="text-amber-500" />
        <span>
          Tài khoản của bạn chưa được xác thực. Vui lòng xác thực tài khoản{' '}
          <Link to={verificationPath} className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
            tại đây
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
