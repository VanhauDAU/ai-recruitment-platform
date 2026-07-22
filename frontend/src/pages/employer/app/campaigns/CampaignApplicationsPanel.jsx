import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import {
  applicationKeys,
  getRecruiterApplications,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application'

const STATUS_COLORS = {
  submitted: 'green', viewed: 'blue', considering: 'gold', shortlisted: 'cyan',
  interviewed: 'purple', accepted: 'success', rejected: 'error',
}

export default function CampaignApplicationsPanel({ publicId }) {
  const params = { campaign: publicId }
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(params),
    queryFn: () => getRecruiterApplications(params),
  })
  const applications = applicationsQuery.data || []

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table
        rowKey="public_id"
        loading={applicationsQuery.isLoading}
        dataSource={applications}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty description="Chiến dịch chưa có CV ứng tuyển" /> }}
        columns={[
          { title: 'Ứng viên', render: (_, item) => <strong className="text-slate-900">{item.candidate_name || item.candidate_email}</strong> },
          { title: 'Tin tuyển dụng', dataIndex: 'job_title' },
          { title: 'Trạng thái', dataIndex: 'status', render: (status) => <Tag color={STATUS_COLORS[status]}>{RECRUITER_APPLICATION_STATUS_LABELS[status] || status}</Tag> },
          { title: 'Ngày nộp', dataIndex: 'applied_at', render: (value) => new Date(value).toLocaleDateString('vi-VN') },
          { title: '', render: () => <Link to={`/tuyendung/app/applications?campaign=${publicId}`}>Xử lý hồ sơ</Link> },
        ]}
      />
    </Card>
  )
}
