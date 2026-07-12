import { WarningFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useSession } from '@/entities/session'

export default function EmailVerificationBanner({ verificationPath }) {
  const { user } = useSession()

  // `provider` không còn có trong dữ liệu user từ API. Tài khoản OAuth đã được
  // backend đánh dấu xác thực khi đăng nhập, nên chỉ cần dựa vào trạng thái này.
  if (!user || user.email_verified) return null

  return (
    <div className="relative bg-red-600 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-2.5 text-center text-sm">
        <WarningFilled className="shrink-0 text-white/90" />
        <span>
          Tài khoản của bạn chưa được xác thực. Vui lòng xác thực tài khoản{' '}
          <Link
            to={verificationPath}
            className="font-semibold !text-white !underline underline-offset-2 hover:!text-white"
          >
            tại đây
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
