import { Skeleton } from 'antd'

export default function JobAlertListSkeleton() {
  return (
    <div aria-label="Đang tải thông báo việc làm" role="status" className="space-y-3">
      {[0, 1].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ))}
    </div>
  )
}
