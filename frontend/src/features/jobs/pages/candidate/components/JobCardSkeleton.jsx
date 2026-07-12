import { Skeleton } from 'antd'

export default function JobCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <Skeleton.Avatar active shape="square" size={80} className="!rounded-lg" />
      <div className="flex-1">
        <Skeleton active title={{ width: '55%' }} paragraph={{ rows: 2, width: ['35%', '70%'] }} />
      </div>
    </div>
  )
}
