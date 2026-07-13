import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useSession } from '@/entities/session'

export default function JobPreferencesReminder() {
  const { user } = useSession()

  // Banner xác thực email được render trước component này, nên lời nhắc này
  // chỉ xuất hiện sau khi tài khoản đã được xác thực.
  if (!user || user.role !== 'candidate' || !user.email_verified || user.job_preferences_configured) return null

  return (
    <div className="border-b border-emerald-100 bg-emerald-50 text-emerald-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm">
        <span>Hãy chia sẻ nhu cầu công việc để nhận gợi ý việc làm tốt nhất.</span>
        <Link to="/onboard-user" className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline">
          Cập nhật nhu cầu công việc <ArrowRightOutlined className="text-xs" />
        </Link>
      </div>
    </div>
  )
}
