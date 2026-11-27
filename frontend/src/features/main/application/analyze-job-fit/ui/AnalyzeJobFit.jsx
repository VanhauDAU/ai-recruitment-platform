import { RightOutlined } from '@ant-design/icons'
import { Suspense, lazy, useState } from 'react'
import { useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'
import { ProcvMascot } from '@/shared/ui/mascot'
import './job-fit-trigger.css'

// Hộp thoại (antd Modal, CSS kết quả) chỉ tải khi ứng viên mở.
const JobFitDialog = lazy(() => import('./JobFitDialog'))

// Thẻ "Xem độ phù hợp" trên trang chi tiết tin. `beforeOpen` do trang truyền vào
// (mời đăng nhập, chặn tài khoản không phải ứng viên); trả false thì không mở.
// `placement`: `sidebar` chỉ hiện từ 1024 px (cột phải), `inline` chỉ hiện dưới
// 1024 px (ngay dưới thông tin chính của tin), để mỗi màn hình có đúng một thẻ;
// `floating`: điện thoại, mascot + nhãn AI + một dòng chữ, nổi ở góc phải trên nút Góp ý.
export default function AnalyzeJobFit({ job, beforeOpen = () => true, onApply, placement = 'sidebar' }) {
  const { settings } = useSiteSettings()
  const [open, setOpen] = useState(false)
  if (settings.ai_job_match_enabled !== true) return null

  const label = m.candidate_job_fit_trigger_label()
  const openDialog = () => beforeOpen() && setOpen(true)

  return (
    <>
      {placement === 'floating'
        ? (
            <button type="button" className="jf-fab" aria-label={label} onClick={openDialog}>
              <span className="jf-fab__label" aria-hidden="true">{m.candidate_job_fit_fab_label()}</span>
              <span className="jf-fab__robot">
                <ProcvMascot blink emotion="happy" pose="wave" size={64} />
                <span className="jf-fab__badge" aria-hidden="true">AI</span>
              </span>
            </button>
          )
        : (
            <button
              type="button"
              className={`jf-trigger jf-trigger--${placement}`}
              aria-label={label}
              onClick={openDialog}
            >
              <span className="jf-trigger__mascot">
                <ProcvMascot blink emotion="happy" pose="wave" size={72} />
              </span>
              <span className="jf-trigger__text">
                <span className="jf-trigger__title">
                  {m.candidate_job_fit_trigger_title()} <span className="jf-trigger__badge">AI</span>
                </span>
                <span className="jf-trigger__hint">{m.candidate_job_fit_trigger_hint()}</span>
              </span>
              <span className="jf-trigger__go" aria-hidden="true"><RightOutlined /></span>
            </button>
          )}
      {open && (
        <Suspense fallback={null}>
          <JobFitDialog job={job} onClose={() => setOpen(false)} onApply={onApply} />
        </Suspense>
      )}
    </>
  )
}
