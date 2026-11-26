import { MessageOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import FeedbackModal from './FeedbackModal'

// Vị trí theo trang: trang thường nằm trên thanh tab dưới (--page-bottom-bar-height);
// trình chỉnh sửa CV nằm ngay trên cụm zoom (CanvasZoomControls: bottom-20 / lg:bottom-5).
const PLACEMENT = {
  page: 'right-4 md:right-6',
  editor: 'right-3 bottom-[8.5rem] lg:right-5 lg:bottom-[4.5rem]',
}
const PAGE_BOTTOM = {
  bottom: 'calc(clamp(1.25rem, 3vw, 2rem) + var(--page-bottom-bar-height, 0px) + env(safe-area-inset-bottom, 0px))',
}

/** Nút nhỏ góc phải dưới mở form góp ý & báo lỗi (phía ứng viên). */
export default function FeedbackLauncher({ placement = 'page' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip title={m.candidate_feedback_launcher()} placement="left">
        <button
          type="button"
          aria-label={m.candidate_feedback_launcher()}
          onClick={() => setOpen(true)}
          style={placement === 'page' ? PAGE_BOTTOM : undefined}
          className={`feedback-launcher fixed z-30 ${PLACEMENT[placement]}`}
        >
          <MessageOutlined aria-hidden />
          <span className="feedback-launcher__label">{m.candidate_feedback_launcher()}</span>
        </button>
      </Tooltip>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
