import {
  ArrowLeftOutlined,
  CalendarOutlined,
  EditOutlined,
  EyeOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { Button, Tag } from 'antd'
import dayjs from 'dayjs'
import { Link, useNavigate } from 'react-router-dom'

const STATUS = {
  draft: ['Nháp', 'default'],
  pending: ['Chờ duyệt', 'gold'],
  active: ['Đang tuyển', 'green'],
  closed: ['Đã đóng', 'default'],
  rejected: ['Từ chối', 'red'],
}

export default function JobDetailHeader({ job, publicId, closing, onClose, onDeadlineAction }) {
  const navigate = useNavigate()
  const status = job.is_expired ? ['Hết hạn', 'orange'] : (STATUS[job.status] || [job.status, 'default'])
  const deadline = job.deadline ? dayjs(job.deadline).format('DD/MM/YYYY') : 'Không giới hạn'
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <Link to="/tuyendung/app/jobs" className="inline-flex items-center gap-2 text-sm !text-slate-500 hover:!text-[var(--brand-primary)]">
        <ArrowLeftOutlined /> Quay lại danh sách tin
      </Link>
      <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-black leading-tight text-slate-900 sm:text-[28px]">{job.title}</h1>
            <Tag color={status[1]} className="!m-0">{status[0]}</Tag>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {job.campaign_name || 'Không gắn chiến dịch'} <span className="mx-2 text-slate-300">•</span> #{publicId}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><CalendarOutlined /> Hạn nộp {deadline}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><EyeOutlined /> {job.view_count || 0} lượt xem</span>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          {job.status !== 'closed' && (
            <Button className="!w-full sm:!w-auto" icon={<EditOutlined />} onClick={() => navigate(`/tuyendung/app/jobs/${publicId}/edit`)}>
              {job.status === 'rejected' ? 'Chỉnh sửa và gửi lại' : 'Chỉnh sửa'}
            </Button>
          )}
          {job.status === 'active' && job.is_expired && (
            <Button className="!w-full sm:!w-auto" type="primary" icon={<SyncOutlined />} onClick={() => onDeadlineAction('extend')}>Gia hạn</Button>
          )}
          {job.status === 'active' && (
            <Button className="!w-full sm:!w-auto" danger icon={<StopOutlined />} loading={closing} onClick={onClose}>Đóng tin</Button>
          )}
          {job.status === 'closed' && (
            <Button className="!w-full sm:!w-auto" type="primary" icon={<SyncOutlined />} onClick={() => onDeadlineAction('reopen')}>Mở lại tin</Button>
          )}
        </div>
      </div>
    </header>
  )
}
