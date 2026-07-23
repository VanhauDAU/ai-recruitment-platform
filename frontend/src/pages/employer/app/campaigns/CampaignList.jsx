import {
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
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
  Select,
  Table,
  Tag,
  message,
} from 'antd'
import { Children, Fragment, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAMPAIGN_SCOPE_OPTIONS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  changeCampaignStatus,
  createCampaign,
  getCampaigns,
  updateCampaign,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignJobsSummary from './CampaignJobsSummary'

function TextAction({ onClick, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium text-slate-900 transition-colors ${danger ? 'hover:text-red-600' : 'hover:text-emerald-600'}`}
    >
      {children}
    </button>
  )
}

function ActionRow({ children, className = '' }) {
  const items = Children.toArray(children).filter(Boolean)
  if (items.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden className="h-3 w-px bg-slate-200" />}
          {item}
        </Fragment>
      ))}
    </div>
  )
}

function formatUpdatedAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

export default function CampaignList() {
  const [activityCampaign, setActivityCampaign] = useState(null)
  const [editCampaign, setEditCampaign] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const createOpen = Boolean(location.state?.createCampaign)
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
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
  const updateNameMutation = useMutation({
    mutationFn: ({ publicId, name }) => updateCampaign(publicId, { name }),
    onSuccess: () => {
      invalidateCampaigns()
      setEditCampaign(null)
      message.success('Đã cập nhật tên chiến dịch.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật chiến dịch.')),
  })
  const campaigns = campaignsQuery.data || []

  function setCreateOpen(open) {
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: open ? { ...location.state, createCampaign: true } : null,
    })
  }

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

  function CampaignInlineActions({ campaign }) {
    return (
      <ActionRow>
        <TextAction onClick={() => setEditCampaign(campaign)}>Sửa chiến dịch</TextAction>
        <TextAction onClick={() => navigate(`/tuyendung/app/campaigns/${campaign.public_id}?active_tab=job`)}>Xem báo cáo</TextAction>
        <TextAction onClick={() => navigate(`/tuyendung/app/campaigns/${campaign.public_id}?tab=applications`)}>Xem CV ứng tuyển</TextAction>
      </ActionRow>
    )
  }

  function CampaignStatusActions({ campaign, block = false }) {
    const canResume = ['draft', 'paused', 'completed'].includes(campaign.status)
    return (
      <div className={`flex flex-wrap gap-2 ${block ? '[&>*]:flex-1' : ''}`}>
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
          <div className="mt-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
            <CampaignInlineActions campaign={campaign} />
          </div>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      width: 320,
      render: (_, campaign) => (
        <CampaignJobsSummary
          campaign={campaign}
          onCreate={() => navigate(`/tuyendung/app/jobs/new?campaign=${campaign.public_id}`)}
        />
      ),
    },
    {
      title: 'Tổng CV',
      width: 160,
      render: (_, campaign) => (
        <Link to={`/tuyendung/app/applications?campaign=${campaign.public_id}`} className="font-semibold !text-slate-700">
          {campaign.application_count || 0} hồ sơ
          {campaign.unviewed_application_count > 0 && <Tag className="ml-2" color="green">{campaign.unviewed_application_count} mới</Tag>}
        </Link>
      ),
    },
    {
      title: 'Cập nhật',
      width: 130,
      render: (_, campaign) => <span>{formatUpdatedAt(campaign.updated_at)}</span>,
    },
    { title: 'Thao tác', width: 140, render: (_, campaign) => <CampaignStatusActions campaign={campaign} /> },
  ]

  return (
    <section className="space-y-5">
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
            <div className="mt-4 space-y-3">
              <CampaignJobsSummary
                compact
                campaign={campaign}
                onCreate={() => navigate(`/tuyendung/app/jobs/new?campaign=${campaign.public_id}`)}
              />
            </div>
            <div className="mt-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">Tổng CV</span><strong className="mt-1 block">{campaign.application_count || 0}</strong>{campaign.unviewed_application_count > 0 && <span className="ml-1 text-emerald-600">· {campaign.unviewed_application_count} mới</span>}</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Cập nhật: {formatUpdatedAt(campaign.updated_at)}</p>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><CampaignInlineActions campaign={campaign} /><CampaignStatusActions campaign={campaign} block /></div>
          </Card>
        ))}
      </div>
      <Card className="hidden lg:block" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="public_id"
          loading={campaignsQuery.isLoading}
          dataSource={campaigns}
          locale={{ emptyText: <Empty description="Chưa có chiến dịch phù hợp" /> }}
          pagination={false}
          scroll={{ x: 950 }}
          onRow={() => ({ className: 'group' })}
          columns={columns}
          className="[&_.ant-table-cell:not(:last-child)]:!border-r [&_.ant-table-cell:not(:last-child)]:!border-slate-200/70"
        />
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
          <Card size="small"><TeamOutlined className="text-xl text-slate-500" /><h2 className="mt-3 font-bold text-slate-900">Xem workspace chiến dịch</h2><p className="mt-1 text-sm text-slate-500">Theo dõi tin tuyển dụng và hồ sơ ứng viên.</p><Button className="mt-4 w-full" onClick={() => navigate(`/tuyendung/app/campaigns/${activityCampaign.public_id}`)}>Xem chiến dịch</Button></Card>
        </div>
      </Modal>

      <Modal
        destroyOnHidden
        open={Boolean(editCampaign)}
        title="Sửa chiến dịch tuyển dụng"
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={updateNameMutation.isPending}
        onCancel={() => setEditCampaign(null)}
        onOk={() => editForm.submit()}
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={{ name: editCampaign?.name }}
          onFinish={({ name }) => updateNameMutation.mutate({ publicId: editCampaign.public_id, name: name.trim() })}
        >
          <Form.Item label="Tên chiến dịch tuyển dụng" name="name" rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch tuyển dụng.' }]}>
            <Input autoFocus maxLength={255} onPressEnter={(event) => { event.preventDefault(); editForm.submit() }} />
          </Form.Item>
        </Form>
      </Modal>

    </section>
  )
}
