import {
  FileTextOutlined,
  HistoryOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Empty, Pagination, Select, Skeleton, Timeline } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  campaignKeys,
  getCampaignActivities,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const GROUP_ICONS = {
  campaign: HistoryOutlined,
  job: FileTextOutlined,
  application: TeamOutlined,
}

function activityText(activity) {
  const metadata = activity.metadata || {}
  if (activity.group === 'job') return metadata.title || 'Tin tuyển dụng'
  if (activity.group === 'application') {
    return [metadata.candidate_name, metadata.job_title].filter(Boolean).join(' · ')
  }
  return metadata.label || metadata.name || ''
}

function activityLink(publicId, activity) {
  if (!activity.subject_public_id) return null
  if (activity.group === 'job') {
    return `/tuyendung/app/jobs/${activity.subject_public_id}`
  }
  if (activity.group === 'application') {
    return `/tuyendung/app/applications?campaign=${publicId}&application=${activity.subject_public_id}`
  }
  return null
}

export default function CampaignActivityPanel({ publicId }) {
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const params = {
    page,
    ...(group ? { group } : {}),
  }
  const query = useQuery({
    queryKey: campaignKeys.activities(publicId, params),
    queryFn: () => getCampaignActivities(publicId, params),
  })
  const pageData = query.data || { count: 0, results: [] }

  return (
    <div className="p-4 lg:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-bold text-slate-800">Lịch sử hoạt động</h2>
          <p className="text-xs text-slate-400">
            Lịch sử chi tiết được ghi nhận từ khi tính năng này phát hành.
          </p>
        </div>
        <Select
          aria-label="Lọc nhóm hoạt động"
          value={group}
          className="w-48"
          options={[
            { value: '', label: 'Tất cả hoạt động' },
            { value: 'campaign', label: 'Chiến dịch' },
            { value: 'job', label: 'Tin tuyển dụng' },
            { value: 'application', label: 'Ứng viên' },
          ]}
          onChange={(value) => {
            setGroup(value)
            setPage(1)
          }}
        />
      </div>
      {query.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải lịch sử hoạt động"
          description={getApiErrorMessage(query.error, 'Vui lòng thử lại sau.')}
          action={(
            <button
              type="button"
              className="font-semibold text-red-700"
              onClick={() => query.refetch()}
            >
              Thử lại
            </button>
          )}
        />
      ) : query.isLoading ? (
        <Skeleton active paragraph={{ rows: 7 }} />
      ) : pageData.results?.length ? (
        <>
          <Timeline
            items={pageData.results.map((activity) => {
              const Icon = GROUP_ICONS[activity.group] || HistoryOutlined
              const link = activityLink(publicId, activity)
              const description = activityText(activity)
              return {
                dot: <Icon className="text-emerald-600" />,
                children: (
                  <div className="pb-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <strong className="text-slate-800">{activity.event_label}</strong>
                      <span className="text-xs text-slate-400">
                        {new Date(activity.occurred_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {description && (
                      link
                        ? <Link to={link} className="mt-1 block text-sm !text-emerald-700">{description}</Link>
                        : <p className="mt-1 text-sm text-slate-600">{description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      Thực hiện bởi {activity.actor_name}
                    </p>
                  </div>
                ),
              }
            })}
          />
          {pageData.count > 20 && (
            <div className="flex justify-center">
              <Pagination
                current={page}
                pageSize={20}
                total={pageData.count}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động phù hợp" />
      )}
    </div>
  )
}
