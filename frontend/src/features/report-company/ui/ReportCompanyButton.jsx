import { FlagOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useCandidateAudience } from '@/entities/session'
import ReportCompanyModal from './ReportCompanyModal'

/**
 * Lối vào ít nổi bật của luồng báo cáo thông tin công ty. Khách được mời đăng
 * nhập qua `onRequireLogin` rồi mở form; nhà tuyển dụng và quản trị viên không
 * thấy nút. `sections` là các khối `{ key, title }` của trang để chọn phần liên quan.
 */
export default function ReportCompanyButton({ company, sections, onRequireLogin }) {
  const audience = useCandidateAudience()
  const [open, setOpen] = useState(false)
  if (!audience) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (audience === 'guest' ? onRequireLogin(() => setOpen(true)) : setOpen(true))}
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
      >
        <FlagOutlined aria-hidden="true" /> Báo cáo thông tin sai
      </button>
      <ReportCompanyModal company={company} sections={sections} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
