import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerJobs, jobKeys } from '@/entities/job'

const JOB_STATUS = {
  draft: ['Nháp', 'default'], pending: ['Chờ duyệt', 'gold'], active: ['Đang tuyển', 'green'],
  closed: ['Đã đóng', 'default'], rejected: ['Từ chối', 'red'],
}

function JobStatus({ job }) {
  if (job.is_expired) return <Tag color="orange">Hết hạn</Tag>
  return <Tag color={JOB_STATUS[job.status]?.[1]}>{JOB_STATUS[job.status]?.[0] || job.status}</Tag>
}

export default function CampaignJobsPanel({ publicId }) {
  const params = { campaign: publicId }
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(params),
    queryFn: () => getEmployerJobs(params),
  })
  const jobs = jobsQuery.data || []

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table
        rowKey="public_id"
        loading={jobsQuery.isLoading}
        dataSource={jobs}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty description="Chiến dịch chưa có tin tuyển dụng" /> }}
        columns={[
          { title: 'Tin tuyển dụng', dataIndex: 'title', render: (title, job) => <Link className="font-bold !text-slate-900 hover:!text-emerald-700" to={`/tuyendung/app/jobs/${job.public_id}`}>{title || 'Tin nháp chưa đặt tên'}</Link> },
          { title: 'Trạng thái', render: (_, job) => <JobStatus job={job} /> },
          { title: 'Hồ sơ', dataIndex: 'application_count', align: 'right', render: (count, job) => <Link to={`/tuyendung/app/applications?job=${job.public_id}`}>{count || 0}</Link> },
          { title: 'Lượt xem', dataIndex: 'view_count', align: 'right' },
          { title: 'Hạn nộp', dataIndex: 'deadline', render: (value) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Không giới hạn' },
        ]}
      />
    </Card>
  )
}
