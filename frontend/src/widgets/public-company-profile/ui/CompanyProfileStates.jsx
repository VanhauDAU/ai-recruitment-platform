import { ReloadOutlined } from '@ant-design/icons'
import { Button, Result, Skeleton } from 'antd'
import { Link } from 'react-router'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company'

export function CompanyProfileSkeleton() {
  return (
    <div className="bg-[#f5f7f8] pb-24 pt-5 lg:pb-10" aria-busy="true" aria-label="Đang tải trang công ty">
      <div className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="h-28 motion-safe:animate-pulse bg-slate-100" />
          <div className="p-6"><Skeleton active avatar={{ shape: 'square', size: 64 }} paragraph={{ rows: 2 }} /></div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active paragraph={{ rows: 4 }} /></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
        </div>
      </div>
    </div>
  )
}

export function CompanyProfileNotFound() {
  return (
    <Result
      status="404"
      title="Không tìm thấy công ty"
      subTitle="Trang công ty này không tồn tại hoặc không còn được hiển thị."
      extra={<Link to={COMPANY_DIRECTORY_PATH}><Button type="primary">Xem danh sách công ty</Button></Link>}
    />
  )
}

export function CompanyProfileError({ onRetry }) {
  return (
    <div className="bg-[#f5f7f8] px-4 py-10">
      <div className="mx-auto max-w-6xl rounded-xl border border-red-100 bg-white px-5 py-10 text-center shadow-sm" role="alert">
        <p className="text-lg font-bold text-slate-900">Không thể tải trang công ty</p>
        <p className="mt-2 text-sm text-slate-500">Kết nối đang gặp sự cố. Vui lòng thử lại.</p>
        <button type="button" onClick={() => onRetry()} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50">
          <ReloadOutlined aria-hidden="true" /> Thử lại
        </button>
      </div>
    </div>
  )
}
