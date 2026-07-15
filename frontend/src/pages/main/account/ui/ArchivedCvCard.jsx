import { UndoOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useState } from 'react'
import { restoreCv } from '@/entities/cv'

export default function ArchivedCvCard({ cv, onRefresh }) {
  const [restoring, setRestoring] = useState(false)
  const archivedDate = cv.archived_at
    ? new Date(cv.archived_at).toLocaleDateString('vi-VN')
    : 'gần đây'

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await restoreCv(cv.public_id)
      message.success('Đã khôi phục CV. CV sẽ không tự trở thành CV mặc định.')
      onRefresh?.()
    } catch (error) {
      const detail = error?.response?.data?.detail
      message.error(detail || 'Không thể khôi phục CV này.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <article className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <h4 className="truncate text-sm font-bold text-slate-800">{cv.title}</h4>
        <p className="mt-1 text-xs text-slate-500">Đã lưu trữ {archivedDate}</p>
      </div>
      <button
        type="button"
        disabled={restoring}
        onClick={handleRestore}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#00b14f] px-3.5 py-1.5 text-xs font-bold text-[#008a3e] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UndoOutlined /> {restoring ? 'Đang khôi phục' : 'Khôi phục'}
      </button>
    </article>
  )
}
