import { RightOutlined } from '@ant-design/icons'
import { Suspense, lazy, useState } from 'react'
import { useSiteSettings } from '@/entities/site-settings'
import { ProcvMascot } from '@/shared/ui/mascot'
import './job-fit-trigger.css'

// Hộp thoại (antd Modal, CSS kết quả) chỉ tải khi ứng viên mở.
const JobFitDialog = lazy(() => import('./JobFitDialog'))

// Thẻ "Xem độ phù hợp" trên trang chi tiết tin. `beforeOpen` do trang truyền vào
// (mời đăng nhập, chặn tài khoản không phải ứng viên); trả false thì không mở.
// `placement`: `sidebar` chỉ hiện từ 1024 px (cột phải), `inline` chỉ hiện dưới
// 1024 px (ngay dưới thông tin chính của tin), để mỗi màn hình có đúng một thẻ.
export default function AnalyzeJobFit({ job, beforeOpen = () => true, onApply, placement = 'sidebar' }) {
  const { settings } = useSiteSettings()
  const [open, setOpen] = useState(false)
  if (settings.ai_job_match_enabled !== true) return null

  return (
    <>
      <button
        type="button"
        className={`jf-trigger jf-trigger--${placement}`}
        aria-label="Xem độ phù hợp với CV của bạn"
        onClick={() => beforeOpen() && setOpen(true)}
      >
        <span className="jf-trigger__mascot">
          <ProcvMascot blink emotion="happy" pose="wave" size={72} />
        </span>
        <span className="jf-trigger__text">
          <span className="jf-trigger__title">
            Xem độ phù hợp <span className="jf-trigger__badge">AI</span>
          </span>
          <span className="jf-trigger__hint">So CV của bạn với từng yêu cầu của tin, chỉ ra kỹ năng còn thiếu.</span>
        </span>
        <span className="jf-trigger__go" aria-hidden="true"><RightOutlined /></span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <JobFitDialog job={job} onClose={() => setOpen(false)} onApply={onApply} />
        </Suspense>
      )}
    </>
  )
}
