import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Descriptions, Modal, Skeleton, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  closeEmployerJob,
  extendEmployerJob,
  getEmployerJob,
  jobKeys,
  reopenEmployerJob,
} from '@/entities/job'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'

const STATUS_LABELS = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang tuyển',
  closed: 'Đã đóng',
  rejected: 'Từ chối',
}

export default function JobDetail() {
  const { publicId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deadlineAction, setDeadlineAction] = useState(null)
  const [newDeadline, setNewDeadline] = useState(null)
  const jobQuery = useQuery({
    queryKey: jobKeys.employerDetail(publicId),
    queryFn: () => getEmployerJob(publicId),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: jobKeys.employerDetail(publicId) })
    queryClient.invalidateQueries({ queryKey: ['jobs', 'employer-list'] })
  }
  const closeMutation = useMutation({
    mutationFn: closeEmployerJob,
    onSuccess: () => {
      invalidate()
      message.success('Đã đóng tin.')
    },
  })
  const deadlineMutation = useMutation({
    mutationFn: ({ action, deadline }) => (
      action === 'reopen'
        ? reopenEmployerJob(publicId, deadline)
        : extendEmployerJob(publicId, deadline)
    ),
    onSuccess: () => {
      invalidate()
      setDeadlineAction(null)
      setNewDeadline(null)
      message.success('Đã cập nhật hạn nộp và trạng thái tin.')
    },
  })

  function openDeadlineAction(action) {
    setDeadlineAction(action)
    setNewDeadline(jobQuery.data?.deadline ? dayjs(jobQuery.data.deadline) : null)
  }

  function submitDeadlineAction() {
    if (!newDeadline) {
      message.error('Chọn hạn nộp mới.')
      return
    }
    deadlineMutation.mutate({ action: deadlineAction, deadline: newDeadline.format('YYYY-MM-DD') })
  }

  if (jobQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (jobQuery.isError) return <Alert type="error" showIcon title="Không thể tải tin tuyển dụng." />
  const job = jobQuery.data

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{job.campaign_name || 'Không gắn chiến dịch'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status !== 'closed' && (
            <Button onClick={() => navigate(`/tuyendung/app/jobs/${publicId}/edit`)}>
              {job.status === 'rejected' ? 'Chỉnh sửa và gửi lại' : 'Chỉnh sửa'}
            </Button>
          )}
          {job.status === 'active' && job.is_expired && (
            <Button type="primary" onClick={() => openDeadlineAction('extend')}>Gia hạn</Button>
          )}
          {job.status === 'active' && (
            <Button danger loading={closeMutation.isPending} onClick={() => closeMutation.mutate(publicId)}>
              Đóng tin
            </Button>
          )}
          {job.status === 'closed' && (
            <Button type="primary" onClick={() => openDeadlineAction('reopen')}>Mở lại tin</Button>
          )}
        </div>
      </div>
      <Descriptions bordered column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Trạng thái">
          <Tag color={job.status === 'active' && !job.is_expired ? 'green' : 'default'}>
            {job.is_expired ? 'Hết hạn' : STATUS_LABELS[job.status] || job.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Hạn nộp">{job.deadline || '—'}</Descriptions.Item>
        <Descriptions.Item label="Hồ sơ">
          <Link to={`/tuyendung/app/applications?job=${publicId}`}>{job.application_count}</Link>
        </Descriptions.Item>
        <Descriptions.Item label="Lượt xem">{job.view_count}</Descriptions.Item>
      </Descriptions>
      {job.status === 'pending' && (
        <Alert
          type="info"
          showIcon
          message="Tin đang chờ quản trị viên duyệt"
          description="Tin chưa hiển thị với ứng viên cho đến khi được duyệt."
        />
      )}
      {job.status === 'rejected' && (
        <Alert
          type="error"
          showIcon
          message="Tin tuyển dụng bị từ chối"
          description={job.rejected_reason || 'Quản trị viên chưa cung cấp lý do.'}
        />
      )}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Mô tả công việc</h2>
        <div
          className="prose mt-3 max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '<p>Chưa có mô tả.</p>') }}
        />
      </article>
      <Modal
        open={Boolean(deadlineAction)}
        title={deadlineAction === 'reopen' ? 'Mở lại tin tuyển dụng' : 'Gia hạn tin tuyển dụng'}
        okText={deadlineAction === 'reopen' ? 'Mở lại tin' : 'Gia hạn'}
        confirmLoading={deadlineMutation.isPending}
        onCancel={() => setDeadlineAction(null)}
        onOk={submitDeadlineAction}
      >
        <p className="mb-3 text-sm text-slate-600">Hạn nộp mới phải từ hôm nay trở đi.</p>
        <DatePicker
          className="!w-full"
          value={newDeadline}
          disabledDate={(current) => current && current < dayjs().startOf('day')}
          onChange={setNewDeadline}
        />
      </Modal>
    </section>
  )
}
