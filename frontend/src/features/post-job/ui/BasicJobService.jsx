import { CheckCircleFilled, RocketOutlined } from '@ant-design/icons'

export default function BasicJobService() {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-emerald-600 shadow-sm"><RocketOutlined /></span>
      <h3 className="mt-3 font-extrabold text-slate-900">Bạn đang sử dụng tin đăng cơ bản</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500">Tin sẽ được gửi quản trị viên duyệt và hiển thị theo thứ tự tự nhiên sau khi được chấp thuận.</p>
      <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
        <CheckCircleFilled /> Không phát sinh chi phí
      </span>
      <p className="mt-4 text-xs text-slate-400">Các gói tăng hiệu quả và dịch vụ trả phí chưa được phát triển trong giai đoạn này.</p>
    </div>
  )
}
