import { FileTextOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Empty, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  createCampaign,
  createCampaignFromNeed,
  getCampaigns,
  getCampaignSuggestions,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

export default function CampaignList() {
  const [createOpen, setCreateOpen] = useState(false)
  const [activityCampaign, setActivityCampaign] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const campaignsQuery = useQuery({ queryKey: campaignKeys.list(), queryFn: getCampaigns })
  const suggestionsQuery = useQuery({
    queryKey: ['campaigns', 'suggestions'],
    queryFn: getCampaignSuggestions,
  })
  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      form.resetFields()
      setCreateOpen(false)
      setActivityCampaign(campaign)
      message.success('Đã tạo chiến dịch.')
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể tạo chiến dịch. Vui lòng thử lại.'))
    },
  })
  const fromNeedMutation = useMutation({
    mutationFn: createCampaignFromNeed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'suggestions'] })
      message.success('Đã tạo chiến dịch từ nhu cầu tuyển dụng.')
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể tạo chiến dịch. Vui lòng thử lại.'))
    },
  })

  function submitQuickCreate() {
    if (!createMutation.isPending) form.submit()
  }

  function submitQuickCreateWithEnter(event) {
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    submitQuickCreate()
  }

  function startPostJob(campaign) {
    setActivityCampaign(null)
    navigate(`/tuyendung/app/jobs/new?campaign=${campaign.public_id}`)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-extrabold text-slate-900">Chiến dịch tuyển dụng</h1><p className="mt-1 text-sm text-slate-500">Gom các tin và theo dõi hiệu quả tuyển dụng của riêng bạn.</p></div>
        <div className="flex flex-wrap gap-2">
          {(suggestionsQuery.data || []).length > 0 && (
            <Select
              className="min-w-56"
              loading={fromNeedMutation.isPending}
              placeholder="Tạo từ nhu cầu tuyển dụng"
              options={(suggestionsQuery.data || []).map((item) => ({
                value: item.public_id,
                label: `${item.position_category_name} · ${item.headcount} người`,
              }))}
              onChange={(needPublicId) => fromNeedMutation.mutate(needPublicId)}
            />
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo chiến dịch</Button>
        </div>
      </div>
      <Table
        rowKey="public_id"
        loading={campaignsQuery.isLoading}
        dataSource={campaignsQuery.data || []}
        locale={{ emptyText: <Empty description="Chưa có chiến dịch" /> }}
        pagination={false}
        scroll={{ x: 760 }}
        columns={[
          { title: 'Chiến dịch', dataIndex: 'name', render: (name, item) => <Link className="font-bold text-emerald-700" to={`/tuyendung/app/campaigns/${item.public_id}`}>{name}</Link> },
          { title: 'Trạng thái', dataIndex: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{CAMPAIGN_STATUS_LABELS[value] || value}</Tag> },
          { title: 'Tin', dataIndex: 'job_count', align: 'right' },
          { title: 'Hồ sơ', dataIndex: 'application_count', align: 'right' },
          { title: 'Đã nhận offer', dataIndex: 'accepted_count', align: 'right' },
        ]}
      />
      <Modal
        destroyOnHidden
        open={createOpen}
        title="Tạo chiến dịch tuyển dụng"
        okText="Tiếp tục"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={submitQuickCreate}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={({ name }) => createMutation.mutate({ name: name.trim() })}
        >
          <Form.Item
            label="Tên chiến dịch tuyển dụng"
            name="name"
            rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch tuyển dụng.' }]}
          >
            <Input
              autoFocus
              maxLength={255}
              placeholder="Ví dụ: Tuyển dụng Quý 3/2026"
              onPressEnter={submitQuickCreateWithEnter}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        footer={null}
        open={Boolean(activityCampaign)}
        title={activityCampaign ? `Khởi động chiến dịch: ${activityCampaign.name}` : 'Khởi động chiến dịch'}
        onCancel={() => setActivityCampaign(null)}
      >
        <p className="mb-4 text-sm text-slate-500">Chọn hoạt động bạn muốn thực hiện đầu tiên.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card size="small" className="border-emerald-200">
            <FileTextOutlined className="text-xl text-emerald-600" />
            <h2 className="mt-3 font-bold text-slate-900">Đăng tin tuyển dụng</h2>
            <p className="mt-1 text-sm text-slate-500">Tạo tin thuộc chiến dịch và gửi quản trị viên duyệt.</p>
            <Button className="mt-4 w-full" type="primary" onClick={() => startPostJob(activityCampaign)}>Đăng tin</Button>
          </Card>
          <Card size="small" className="border-slate-200 opacity-75">
            <SearchOutlined className="text-xl text-slate-400" />
            <h2 className="mt-3 font-bold text-slate-700">Chủ động tìm kiếm ứng viên</h2>
            <p className="mt-1 text-sm text-slate-500">Lọc CV ứng viên phù hợp từ kho hồ sơ.</p>
            <Button className="mt-4 w-full" disabled>Sắp mở</Button>
          </Card>
        </div>
      </Modal>
    </section>
  )
}
