import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { getAdminJobModeration, jobKeys, reviewAdminJob } from '@/entities/job'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đang tuyển' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'draft', label: 'Nháp' },
  { value: '', label: 'Tất cả' },
]

const STATUS_COLORS = {
  pending: 'gold',
  active: 'green',
  rejected: 'red',
  closed: 'default',
  draft: 'default',
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function AdminJobModeration() {
  const [status, setStatus] = useState('pending')
  const [rejectingJob, setRejectingJob] = useState(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const jobsQuery = useQuery({
    queryKey: jobKeys.adminModeration({ status }),
    queryFn: () => getAdminJobModeration(status ? { status } : {}),
  })
  const reviewMutation = useMutation({
    mutationFn: ({ publicId, payload }) => reviewAdminJob(publicId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs', 'admin-moderation'] })
      if (variables.payload.action === 'approve') message.success('Đã duyệt tin tuyển dụng.')
      else {
        message.success('Đã từ chối tin tuyển dụng và gửi lý do cho nhà tuyển dụng.')
        form.resetFields()
        setRejectingJob(null)
      }
    },
    onError: (error) => {
      message.error(error?.response?.data?.detail || 'Không thể cập nhật trạng thái tin.')
    },
  })

  function submitRejection() {
    form.validateFields().then((values) => {
      reviewMutation.mutate({
        publicId: rejectingJob.public_id,
        payload: { action: 'reject', reason: values.reason },
      })
    })
  }

  const columns = [
    {
      title: 'Tin tuyển dụng',
      dataIndex: 'title',
      width: 270,
      render: (title, item) => (
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{item.company_name} · {item.employer_name}</div>
        </div>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      width: 350,
      render: (value) => <span className="line-clamp-3 text-sm text-slate-600">{value || '—'}</span>,
    },
    { title: 'Hạn nộp', dataIndex: 'deadline', width: 120, render: (value) => value || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (value, item) => <Tag color={STATUS_COLORS[value]}>{item.status_label}</Tag>,
    },
    { title: 'Gửi duyệt', dataIndex: 'submitted_at', width: 165, render: formatDateTime },
    {
      title: 'Lý do từ chối',
      dataIndex: 'rejected_reason',
      width: 260,
      render: (value) => value || '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 190,
      render: (_, item) => item.status === 'pending' ? (
        <Space>
          <Button
            size="small"
            type="primary"
            loading={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate({ publicId: item.public_id, payload: { action: 'approve' } })}
          >
            Duyệt
          </Button>
          <Button size="small" danger disabled={reviewMutation.isPending} onClick={() => setRejectingJob(item)}>
            Từ chối
          </Button>
        </Space>
      ) : '—',
    },
  ]

  return (
    <section>
      <Typography.Title level={2}>Duyệt tin tuyển dụng</Typography.Title>
      <Typography.Paragraph type="secondary">
        Tin chỉ hiển thị với ứng viên sau khi được duyệt. Khi từ chối, lý do sẽ hiện cho người tạo tin.
      </Typography.Paragraph>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Alert className="max-w-2xl" showIcon type="info" message="Mọi tin gửi mới đều cần duyệt" />
        <Select className="w-full sm:w-40" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </div>
      <Table
        rowKey="public_id"
        loading={jobsQuery.isLoading}
        dataSource={jobsQuery.data || []}
        columns={columns}
        scroll={{ x: 1500 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />
      <Modal
        destroyOnHidden
        open={Boolean(rejectingJob)}
        title={rejectingJob ? `Từ chối tin: ${rejectingJob.title}` : 'Từ chối tin'}
        okText="Gửi lý do từ chối"
        cancelText="Hủy"
        confirmLoading={reviewMutation.isPending}
        onCancel={() => { form.resetFields(); setRejectingJob(null) }}
        onOk={submitRejection}
      >
        <p className="mb-3 text-sm text-slate-600">Lý do này sẽ hiển thị cho nhà tuyển dụng để họ chỉnh sửa và gửi duyệt lại.</p>
        <Form form={form} layout="vertical">
          <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true, whitespace: true, message: 'Nhập lý do từ chối.' }]}>
            <Input.TextArea rows={5} maxLength={3000} showCount placeholder="Ví dụ: Vui lòng bổ sung mô tả quyền lợi và mức lương." />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
