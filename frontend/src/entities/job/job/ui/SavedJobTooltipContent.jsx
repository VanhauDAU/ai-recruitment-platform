import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

// Nội dung hướng dẫn dùng chung cho tooltip của các trái tim đã lưu.
export default function SavedJobTooltipContent() {
  return (
    <div className="max-w-[260px] space-y-1 text-xs leading-relaxed">
      <p className="font-semibold text-white">{m.job_saved_tooltip_title()}</p>
      <p>
        {m.job_saved_tooltip_view()} <Link to="/viec-lam-da-luu" onClick={(event) => event.stopPropagation()} className="font-bold text-white underline underline-offset-2">{m.job_saved_tooltip_list()}</Link>{m.job_saved_tooltip_go_to()}
      </p>
      <p className="font-medium text-white/90">{m.job_saved_tooltip_path()}</p>
    </div>
  )
}

