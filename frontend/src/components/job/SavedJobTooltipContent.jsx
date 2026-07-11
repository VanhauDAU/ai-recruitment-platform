import { Link } from 'react-router-dom'

// Nội dung hướng dẫn dùng chung cho tooltip của các trái tim đã lưu.
export default function SavedJobTooltipContent() {
  return (
    <div className="max-w-[260px] space-y-1 text-xs leading-relaxed">
      <p className="font-semibold text-white">Lưu tin thành công!</p>
      <p>
        Để xem <Link to="/viec-lam-da-luu" onClick={(event) => event.stopPropagation()} className="font-bold text-white underline underline-offset-2">Danh sách việc làm đã lưu</Link>, vui lòng truy cập:
      </p>
      <p className="font-medium text-white/90">Menu =&gt; Việc làm =&gt; Việc làm đã lưu</p>
    </div>
  )
}

