import { EyeOutlined } from '@ant-design/icons'
import { Button, Space, Tag } from 'antd'
import {
  adminJobStatusMeta,
  formatAdminJobDate,
  formatAdminJobDateTime,
} from '@/entities/admin-job'

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

export function createCompanyJobColumns({ ordering, openJob }) {
  return [
    {
      title: 'Tin tuyển dụng',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'title'),
      width: 280,
      render: (title, job) => (
        <button
          className="company-directory__company-button"
          onClick={() => openJob(job)}
          type="button"
        >
          <div className="min-w-0 text-left">
            <div className="truncate font-semibold text-slate-900">{title}</div>
            <div className="mt-1 font-mono text-xs text-slate-500">{job.public_id}</div>
          </div>
        </button>
      ),
    },
    {
      title: 'Nhà tuyển dụng',
      dataIndex: 'employer_name',
      key: 'employer',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'employer'),
      width: 230,
      render: (value, job) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800">{value}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{job.employer_email}</div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'status'),
      width: 150,
      render: (_, job) => {
        const meta = adminJobStatusMeta(job)
        return (
          <Space direction="vertical" size={3}>
            <Tag color={meta.color}>{job.status_label || meta.label}</Tag>
            {job.is_expired && <Tag color="orange">Quá hạn</Tag>}
            {(job.policy_hold || job.moderation_hold) && <Tag color="red">Tạm giữ</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Hạn nộp',
      dataIndex: 'deadline',
      key: 'deadline',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'deadline'),
      width: 130,
      render: formatAdminJobDate,
    },
    {
      title: 'Gửi duyệt',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'submitted_at'),
      width: 175,
      render: formatAdminJobDateTime,
    },
    {
      title: 'Ứng tuyển',
      dataIndex: 'application_count',
      key: 'application_count',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'application_count'),
      align: 'right',
      width: 110,
    },
    {
      title: 'Lượt xem',
      dataIndex: 'view_count',
      key: 'view_count',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'view_count'),
      align: 'right',
      width: 105,
    },
    {
      title: 'Báo cáo chờ',
      dataIndex: 'pending_report_count',
      key: 'pending_reports',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'pending_reports'),
      align: 'right',
      width: 125,
      render: (value) => (
        <span className={value ? 'font-semibold text-red-600' : 'text-slate-600'}>
          {value || 0}
        </span>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      key: 'updated_at',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'updated_at'),
      width: 175,
      render: formatAdminJobDateTime,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 105,
      render: (_, job) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => openJob(job)}>
          Chi tiết
        </Button>
      ),
    },
  ]
}
