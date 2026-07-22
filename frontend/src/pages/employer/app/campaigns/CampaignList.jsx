import {
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Table,
  Tag,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAMPAIGN_SCOPE_OPTIONS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  changeCampaignStatus,
  createCampaign,
  createCampaignFromNeed,
  getCampaigns,
  getCampaignSuggestions,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

function recruitmentProgress(campaign) {
  const target = Math.max(campaign.headcount_target || 1, 1)
  return Math.min(Math.round(((campaign.accepted_count || 0) / target) * 100), 100)
}

function JobSignals({ campaign }) {
  const signals = [
    [campaign.active_job_count, 'Đang hiển thị', 'green'],
    [campaign.pending_job_count, 'Chờ duyệt', 'gold'],
    [campaign.expired_job_count, 'Hết hạn', 'orange'],
    [campaign.rejected_job_count, 'Từ chối', 'red'],
    [campaign.draft_job_count, 'Nháp', 'default'],
  ].filter(([count]) => count > 0)
  if (!signals.length) return <span className="text-sm text-slate-400">Chưa có tin</span>
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map(([count, label, color]) => <Tag key={label} color={color}>{count} {label}</Tag>)}
    </div>
  )
}

export default function CampaignList() {
  const [createOpen, setCreateOpen] = useState(false)
  const [activityCampaign, setActivityCampaign] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scope = searchParams.get('scope') || ''
  const queryParams = useMemo(() => ({
    ...(scope ? { scope } : {}),
    ...(searchParams.get('q') ? { q: searchParams.get('q') } : {}),
  }), [scope, searchParams])
  const campaignsQuery = useQuery({
    queryKey: campaignKeys.list(queryParams),
    queryFn: () => getCampaigns(queryParams),
  })
  const suggestionsQuery = useQuery({
    queryKey: ['campaigns', 'suggestions'],
    queryFn: getCampaignSuggestions,
  })
  const invalidateCampaigns = () => queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      invalidateCampaigns()
      form.resetFields()
      setCreateOpen(false)
      setActivityCampaign(campaign)
      message.success('Đã tạo và mở chiến dịch.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tạo chiến dịch.')),
  })
  const statusMutation = useMutation({
    mutationFn: ({ publicId, status }) => changeCampaignStatus(publicId, status),
    onSuccess: (_, variables) => {
      invalidateCampaigns()
      message.success(variables.status === 'active' ? 'Đã mở lại chiến dịch.' : 'Đã dừng chiến dịch.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đổi trạng thái chiến dịch.')),
  })
  const fromNeedMutation = useMutation({
    mutationFn: createCampaignFromNeed,
    onSuccess: (campaign) => {
      invalidateCampaigns()
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'suggestions'] })
      setActivityCampaign(campaign)
      message.success('Đã tạo chiến dịch từ nhu cầu tuyển dụng.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tạo chiến dịch.')),
  })
  const campaigns = campaignsQuery.data || []

  function replaceFilters(next) {
    const values = Object.fromEntries(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value) values[key] = value
      else delete values[key]
    })
    setSearchParams(values)
  }

  function submitQuickCreate() {
    if (!createMutation.isPending) form.submit()
  }

  function submitQuickCreateWithEnter(event) {
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    submitQuickCreate()
  }

  function CampaignActions({ campaign, block = false }) {
    const canResume = ['draft', 'paused', 'completed'].includes(campaign.status)
    return (
      <div className={`flex flex-wrap gap-2 ${block ? '[&>*]:flex-1' : ''}`}>
        <Button size="small"><Link to={`/tuyendung/app/campaigns/${campaign.public_id}`}>Xem</Link></Button>
        <Button size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/tuyendung/app/jobs/new?campaign=${campaign.public_id}`)}>Đăng tin</Button>
        {campaign.status === 'active' && (
          <Popconfirm
            title="Dừng chiến dịch?"
            description="Các tin tuyển dụng không tự động bị đóng."
            okText="Dừng chiến dịch"
            cancelText="Hủy"
            onConfirm={() => statusMutation.mutate({ publicId: campaign.public_id, status: 'paused' })}
          >
            <Button size="small" icon={<PauseCircleOutlined />}>Dừng</Button>
          </Popconfirm>
        )}
        {canResume && <Button size="small" icon={<PlayCircleOutlined />} onClick={() => statusMutation.mutate({ publicId: campaign.public_id, status: 'active' })}>Mở lại</Button>}
      </div>
    )
  }

  const columns = [
    {
      title: 'Chiến dịch tuyển dụng',
      render: (_, campaign) => (
        <div className="min-w-56">
          <span className="text-xs text-slate-400">#{campaign.public_id}</span>
          <Link className="mt-1 block font-bold !text-slate-900 hover:!text-emerald-700" to={`/tuyendung/app/campaigns/${campaign.public_id}`}>{campaign.name}</Link>
          <Tag className="mt-2" color={CAMPAIGN_STATUS_COLORS[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Tag>
        </div>
      ),
    },
    {
      title: 'CV ứng tuyển',
      width: 130,
      render: (_, campaign) => (
        <Link to={`/tuyendung/app/applications?campaign=${campaign.public_id}`} className="font-semibold !text-slate-700">
          {campaign.application_count || 0} hồ sơ
          {campaign.unviewed_application_count > 0 && <Tag className="ml-2" color="green">{campaign.unviewed_application_count} mới</Tag>}
        </Link>
      ),
    },
    { title: 'Tin tuyển dụng', width: 220, render: (_, campaign) => <JobSignals campaign={campaign} /> },
    {
      title: 'Tiến độ tuyển',
      width: 170,
      render: (_, campaign) => (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Đã nhận offer</span><strong>{campaign.accepted_count || 0}/{campaign.headcount_target || 1}</strong></div>
          <Progress percent={recruitmentProgress(campaign)} size="small" showInfo={false} strokeColor="#00b14f" />
        </div>
      ),
    },
    { title: 'Thao tác', width: 260, render: (_, campaign) => <CampaignActions campaign={campaign} /> },
  ]

  return (
    <section className="space-y-5">
      <div className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-extrabold">Quản lý chiến dịch tuyển dụng</h1><p className="mt-1 max-w-2xl text-sm text-emerald-50">Mỗi chiến dịch là một workspace cho một mục tiêu tuyển dụng: tin đăng, hồ sơ và tiến độ xử lý được theo dõi tập trung.</p></div>
          <Button size="large" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Thêm chiến dịch mới</Button>
        </div>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,300px)_minmax(260px,1fr)_auto]">
          <Select value={scope} options={CAMPAIGN_SCOPE_OPTIONS} onChange={(value) => replaceFilters({ scope: value })} />
          <Input
            allowClear
            value={searchValue}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm chiến dịch (Nhấn Enter để tìm kiếm)"
            onChange={(event) => setSearchValue(event.target.value)}
            onClear={() => replaceFilters({ q: '' })}
            onPressEnter={() => replaceFilters({ q: searchValue.trim() })}
          />
          {(suggestionsQuery.data || []).length > 0 && (
            <Select
              className="lg:min-w-64"
              loading={fromNeedMutation.isPending}
              placeholder="Tạo từ nhu cầu đã khai báo"
              options={(suggestionsQuery.data || []).map((item) => ({ value: item.public_id, label: `${item.position_category_name} · ${item.headcount} người` }))}
              onChange={(publicId) => fromNeedMutation.mutate(publicId)}
            />
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500">Tìm thấy <strong className="text-slate-800">{campaigns.length}</strong> chiến dịch tuyển dụng</p>
      </Card>

      <div className="space-y-3 lg:hidden">
        {campaignsQuery.isLoading && <Card loading />}
        {!campaignsQuery.isLoading && campaigns.length === 0 && <Card><Empty description="Chưa có chiến dịch phù hợp" /></Card>}
        {campaigns.map((campaign) => (
          <Card key={campaign.public_id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><span className="text-xs text-slate-400">#{campaign.public_id}</span><Link className="mt-1 block break-words text-base font-bold !text-slate-900" to={`/tuyendung/app/campaigns/${campaign.public_id}`}>{campaign.name}</Link></div>
              <Tag color={CAMPAIGN_STATUS_COLORS[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Tag>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><div><span className="block text-xs text-slate-500">Hồ sơ</span><strong>{campaign.application_count || 0}</strong>{campaign.unviewed_application_count > 0 && <span className="ml-1 text-emerald-600">· {campaign.unviewed_application_count} mới</span>}</div><div><span className="block text-xs text-slate-500">Tin tuyển dụng</span><strong>{campaign.job_count || 0}</strong></div></div>
            <div className="mt-4"><JobSignals campaign={campaign} /></div>
            <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Tiến độ tuyển</span><strong>{campaign.accepted_count || 0}/{campaign.headcount_target || 1}</strong></div><Progress percent={recruitmentProgress(campaign)} showInfo={false} strokeColor="#00b14f" /></div>
            <div className="mt-4 border-t border-slate-100 pt-4"><CampaignActions campaign={campaign} block /></div>
          </Card>
        ))}
      </div>
      <Card className="hidden lg:block" styles={{ body: { padding: 0 } }}>
        <Table rowKey="public_id" loading={campaignsQuery.isLoading} dataSource={campaigns} locale={{ emptyText: <Empty description="Chưa có chiến dịch phù hợp" /> }} pagination={false} scroll={{ x: 1080 }} columns={columns} />
      </Card>

      <Modal destroyOnHidden open={createOpen} title="Tạo chiến dịch tuyển dụng" okText="Tiếp tục" cancelText="Hủy" confirmLoading={createMutation.isPending} onCancel={() => setCreateOpen(false)} onOk={submitQuickCreate}>
        <Form form={form} layout="vertical" onFinish={({ name }) => createMutation.mutate({ name: name.trim() })}>
          <Form.Item label="Tên chiến dịch tuyển dụng" name="name" rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch tuyển dụng.' }]}>
            <Input autoFocus maxLength={255} placeholder="Ví dụ: Tuyển dụng nhân viên Marketing tháng 10" onPressEnter={submitQuickCreateWithEnter} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal destroyOnHidden footer={null} open={Boolean(activityCampaign)} title={activityCampaign ? `Khởi động chiến dịch: ${activityCampaign.name}` : 'Khởi động chiến dịch'} onCancel={() => setActivityCampaign(null)}>
        <p className="mb-4 text-sm text-slate-500">Bạn muốn bắt đầu hoạt động nào? Có thể đóng cửa sổ và thực hiện sau.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card size="small" className="border-emerald-200"><FileTextOutlined className="text-xl text-emerald-600" /><h2 className="mt-3 font-bold text-slate-900">Đăng tin tuyển dụng</h2><p className="mt-1 text-sm text-slate-500">Tạo tin thuộc chiến dịch và gửi quản trị viên duyệt.</p><Button className="mt-4 w-full" type="primary" onClick={() => navigate(`/tuyendung/app/jobs/new?campaign=${activityCampaign.public_id}`)}>Đăng tin</Button></Card>
          <Card size="small"><TeamOutlined className="text-xl text-slate-500" /><h2 className="mt-3 font-bold text-slate-900">Xem workspace chiến dịch</h2><p className="mt-1 text-sm text-slate-500">Theo dõi tin, hồ sơ và tiến độ tuyển dụng.</p><Button className="mt-4 w-full" onClick={() => navigate(`/tuyendung/app/campaigns/${activityCampaign.public_id}`)}>Xem chiến dịch</Button></Card>
        </div>
      </Modal>
    </section>
  )
}
