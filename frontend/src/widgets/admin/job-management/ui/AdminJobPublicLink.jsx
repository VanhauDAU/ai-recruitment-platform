import { ExportOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

const BASE = 'inline-flex w-fit max-w-full items-center gap-1.5 text-xs font-semibold'
const OFF_REASON = 'Tin chưa hiển thị công khai nên chưa có trang cho ứng viên'

export default function AdminJobPublicLink({ job }) {
  const path = `/viec-lam/${job.slug}`
  const label = 'Xem trang công khai'
  const disabled = !job.is_publicly_visible || !job.slug
  const content = <>{label} <ExportOutlined /></>

  if (disabled) {
    return (
      <Tooltip title={OFF_REASON}>
        <span className={`${BASE} cursor-not-allowed text-slate-300`}>{content}</span>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={label}>
      <a
        aria-label={`${label} (tab mới)`}
        className={`${BASE} !text-slate-500 transition hover:!text-emerald-700`}
        href={path}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    </Tooltip>
  )
}
