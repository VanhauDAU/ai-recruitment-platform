import { Spin } from 'antd'
import UserCvCard from './UserCvCard'

// Khối danh sách CV (đã tạo / đã tải lên) — chỉ khác tiêu đề, nút hành động
// và trạng thái rỗng nên dùng chung một section.
export default function CvListSection({ title, action, emptyIcon, emptyText, cvs, loading, onRefresh }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 sm:text-[17px]">{title}</h3>
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#00b14f] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#008a3e] cursor-pointer"
        >
          {action.label}
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : cvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
              {emptyIcon}
            </div>
            <p className="text-sm font-semibold text-slate-400">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {cvs.map((cv) => (
              <UserCvCard key={cv.public_id} cv={cv} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
