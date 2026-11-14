import { BellFilled, BellOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons'
import { useCandidateAudience } from '@/entities/session'
import { useCompanyFollow } from '../model/use-company-follow'
import '../follow-company.css'

/**
 * Nút theo dõi công ty kèm công tắc nhận email việc làm mới khi đang theo dõi.
 * Khách được mời đăng nhập qua `onRequireLogin` rồi theo dõi ngay sau khi đăng
 * nhập; nhà tuyển dụng và quản trị viên không thấy nút. `className` quyết định
 * cách hiển thị của cả cụm, ví dụ `hidden lg:inline-flex`.
 */
export default function FollowCompanyButton({ publicId, onRequireLogin, className = 'inline-flex' }) {
  const audience = useCandidateAudience()
  const follow = useCompanyFollow(publicId)
  if (!audience) return null

  const { following, notifyNewJobs } = follow
  const busy = follow.isLoading || follow.isPending

  function toggle() {
    if (audience === 'guest') onRequireLogin(() => follow.setFollowing(true))
    else follow.setFollowing(!following)
  }

  return (
    <div className={`follow-company ${className}`}>
      <button
        type="button"
        className="follow-company__toggle"
        aria-pressed={following}
        title={following ? 'Bỏ theo dõi công ty' : undefined}
        disabled={busy}
        onClick={toggle}
      >
        {following ? <CheckOutlined aria-hidden="true" /> : <PlusOutlined aria-hidden="true" />}
        {following ? 'Đang theo dõi' : 'Theo dõi'}
      </button>
      {following && (
        <button
          type="button"
          role="switch"
          className="follow-company__notify"
          aria-checked={notifyNewJobs}
          aria-label="Nhận email việc làm mới"
          title={notifyNewJobs ? 'Đang nhận email việc làm mới' : 'Đã tắt email việc làm mới'}
          disabled={busy}
          onClick={() => follow.setNotifyNewJobs(!notifyNewJobs)}
        >
          {notifyNewJobs ? <BellFilled aria-hidden="true" /> : <BellOutlined aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
