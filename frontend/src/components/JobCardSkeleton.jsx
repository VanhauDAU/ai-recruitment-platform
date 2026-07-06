import { Skeleton } from 'antd'

export default function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 2, width: ['40%', '80%'] }} />
    </div>
  )
}
