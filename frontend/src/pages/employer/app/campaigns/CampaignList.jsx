import {
  BarChartOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  RocketOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Alert,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Table,
  Tag,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAMPAIGN_ORDERING_OPTIONS,
  CAMPAIGN_SCOPE_OPTIONS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_OPTIONS,
  campaignKeys,
  createCampaign,
  getCampaigns,
  updateCampaign,
} from '@/entities/campaign'
import {
  CampaignNameForm,
  CampaignLifecycleActions,
} from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignJobsSummary from './CampaignJobsSummary'

const ACTION_TONES = {
  primary: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800',
  neutral: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  blue: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800',
}

function CampaignActionButton({ icon, tone = 'neutral', onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:translate-y-0 active:shadow-xs ${ACTION_TONES[tone]}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

function ActionRow({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {children}
    </div>
  )
}

function formatDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' })
}

const AVATAR_TONES = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
]

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase() || 'ƯV'
}

function CandidateAvatar({ candidate, index, total }) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(candidate.avatar_url) && !imageFailed

  return (
    <span
      title={candidate.full_name}
      style={{ zIndex: total - index }}
      className={`-ml-2.5 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm first:ml-0 ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {hasImage ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          src={candidate.avatar_url}
          onError={() => setImageFailed(true)}
        />
      ) : candidate.public_id === 'candidate-placeholder' ? (
        <UserOutlined aria-hidden className="text-sm" />
      ) : initials(candidate.full_name)}
    </span>
  )
}

function CampaignCandidateAvatars({ campaign }) {
  const candidateCount = Number(campaign.candidate_count) || 0
  const previews = (campaign.candidate_previews || []).slice(0, 5)
  const candidates = previews.length > 0
    ? previews
    : candidateCount > 0
      ? [{ public_id: 'candidate-placeholder', full_name: 'Ứng viên' }]
      : []
  const extraCount = Math.max(candidateCount - candidates.length, 0)

  if (candidateCount === 0) {
    return <span className="text-sm text-slate-500">Chưa có ứng viên</span>
  }

  return (
    <div
      aria-label={`${candidateCount} ứng viên`}
      className="flex h-8 items-center pl-1"
      role="img"
    >
      {candidates.map((candidate, index) => (
        <CandidateAvatar
          key={candidate.public_id}
          candidate={candidate}
          index={index}
          total={candidates.length}
        />
      ))}
      {extraCount > 0 && (
        <span
          className="-ml-2.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-slate-700 px-1 text-[10px] font-bold text-white shadow-sm"
          title={`${extraCount} ứng viên khác`}
        >
          +{extraCount}
        </span>
      )}
    </div>
  )
}

function CampaignCandidateSummary({ campaign }) {
  return (
    <Link
      to={`/tuyendung/app/campaigns/${campaign.public_id}?active_tab=apply_cv`}
      className="block min-w-36 !text-slate-700"
    >
      <CampaignCandidateAvatars campaign={campaign} />
      <span className="mt-1 block text-xs text-slate-500">
        {campaign.application_pair_count
          ?? campaign.application_submission_count
          ?? campaign.application_count
          ?? 0} hồ sơ ứng tuyển
      </span>
      {(campaign.unviewed_count ?? campaign.unviewed_application_count) > 0 && (
        <Tag className="mt-2" color="green">
          {campaign.unviewed_count ?? campaign.unviewed_application_count} chưa xem
        </Tag>
      )}
    </Link>
  )
}

export default function CampaignList() {
  const [activityCampaign, setActivityCampaign] = useState(null)
  const [editCampaign, setEditCampaign] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const createOpen = Boolean(location.state?.createCampaign)
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const status = searchParams.get('status') || ''
  const scope = searchParams.get('scope') || ''
  const ordering = searchParams.get('ordering') || 'activity'
  const page = Number(searchParams.get('page')) || 1
  const queryParams = useMemo(() => ({
    page,
    ordering,
    ...(status ? { status } : {}),
    ...(scope ? { scope } : {}),
    ...(searchParams.get('q') ? { q: searchParams.get('q') } : {}),
  }), [ordering, page, scope, searchParams, status])
  const campaignsQuery = useQuery({
    queryKey: campaignKeys.list(queryParams),
    queryFn: () => getCampaigns(queryParams),
  })
  const invalidateCampaigns = () => queryClient.invalidateQueries({
    queryKey: campaignKeys.all,
  })
  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      invalidateCampaigns()
      form.resetFields()
      setCreateOpen(false)
      setActivityCampaign(campaign)
      message.success('Đã tạo và mở chiến dịch.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể tạo chiến dịch.'),
    ),
  })
  const updateMutation = useMutation({
    mutationFn: ({ publicId, values }) => updateCampaign(publicId, values),
    onSuccess: () => {
      invalidateCampaigns()
      setEditCampaign(null)
      message.success('Đã cập nhật chiến dịch.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể cập nhật chiến dịch.'),
    ),
  })
  const pageData = campaignsQuery.data || {
    count: 0,
    next: null,
    previous: null,
    results: [],
  }
  const campaigns = pageData.results || []

  function setCreateOpen(open) {
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: open ? { ...location.state, createCampaign: true } : null,
    })
  }

  function replaceFilters(next) {
    const values = Object.fromEntries(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value) values[key] = String(value)
      else delete values[key]
    })
    if (!Object.hasOwn(next, 'page')) delete values.page
    setSearchParams(values)
  }

  function CampaignInlineActions({ campaign }) {
    return (
      <ActionRow>
        <CampaignActionButton
          icon={<EditOutlined aria-hidden />}
          tone="primary"
          onClick={() => setEditCampaign(campaign)}
        >
          Sửa chiến dịch
        </CampaignActionButton>
        <CampaignActionButton
          icon={<BarChartOutlined aria-hidden />}
          onClick={() => navigate(
            `/tuyendung/app/campaigns/${campaign.public_id}?active_tab=overview`,
          )}
        >
          Tổng quan
        </CampaignActionButton>
        <CampaignActionButton
          icon={<TeamOutlined aria-hidden />}
          tone="blue"
          onClick={() => navigate(
            `/tuyendung/app/campaigns/${campaign.public_id}?active_tab=apply_cv`,
          )}
        >
          Xem CV
        </CampaignActionButton>
      </ActionRow>
    )
  }

  const columns = [
    {
      title: 'Chiến dịch tuyển dụng',
      render: (_, campaign) => (
        <div className="flex min-w-64 items-start gap-3">
          <div className="pt-0.5">
            <CampaignLifecycleActions campaign={campaign} variant="switch" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-400">#{campaign.public_id}</span>
            <Link
              className="mt-1 block font-bold !text-slate-900 hover:!text-emerald-700"
              to={`/tuyendung/app/campaigns/${campaign.public_id}`}
            >
              {campaign.name}
            </Link>
            <Tag className="mt-2" color={CAMPAIGN_STATUS_COLORS[campaign.status]}>
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </Tag>
            <div className="mt-3 transition-all duration-200 lg:pointer-events-none lg:translate-y-1 lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
              <CampaignInlineActions campaign={campaign} />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      width: 300,
      render: (_, campaign) => (
        <CampaignJobsSummary
          campaign={campaign}
          onCreate={() => navigate(
            `/tuyendung/app/jobs/new?campaign=${campaign.public_id}`,
          )}
        />
      ),
    },
    {
      title: 'Ứng viên / Hồ sơ',
      width: 180,
      render: (_, campaign) => <CampaignCandidateSummary campaign={campaign} />,
    },
    {
      title: 'Hoạt động gần nhất',
      width: 180,
      render: (_, campaign) => (
        <div className="text-sm">
          <strong className="block text-slate-700">
            {campaign.last_activity?.label || 'Cập nhật chiến dịch'}
          </strong>
          <span className="mt-1 block text-xs text-slate-400">
            {formatDate(campaign.last_activity?.occurred_at, true)}
          </span>
        </div>
      ),
    },
  ]

  return (
    <section className="space-y-5">
      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_240px_minmax(220px,1fr)_210px]">
          <Select
            aria-label="Lọc trạng thái chiến dịch"
            value={status}
            options={CAMPAIGN_STATUS_OPTIONS}
            onChange={(value) => replaceFilters({ status: value })}
          />
          <Select
            aria-label="Lọc nhu cầu xử lý"
            value={scope}
            options={CAMPAIGN_SCOPE_OPTIONS}
            onChange={(value) => replaceFilters({ scope: value })}
          />
          <Input
            allowClear
            value={searchValue}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm chiến dịch (Nhấn Enter để tìm kiếm)"
            onChange={(event) => setSearchValue(event.target.value)}
            onClear={() => replaceFilters({ q: '' })}
            onPressEnter={() => replaceFilters({ q: searchValue.trim() })}
          />
          <Select
            aria-label="Sắp xếp chiến dịch"
            value={ordering}
            options={CAMPAIGN_ORDERING_OPTIONS}
            onChange={(value) => replaceFilters({ ordering: value })}
          />
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Tìm thấy <strong className="text-slate-800">{pageData.count || 0}</strong> chiến dịch
        </p>
      </Card>

      {campaignsQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh sách chiến dịch"
          description={getApiErrorMessage(campaignsQuery.error, 'Vui lòng thử lại sau.')}
          action={(
            <Button size="small" danger onClick={() => campaignsQuery.refetch()}>
              Thử lại
            </Button>
          )}
        />
      )}

      <div className="space-y-3 lg:hidden">
        {campaignsQuery.isLoading && <Card loading />}
        {!campaignsQuery.isLoading && campaigns.length === 0 && (
          <Card><Empty description="Chưa có chiến dịch phù hợp" /></Card>
        )}
        {campaigns.map((campaign) => (
          <Card key={campaign.public_id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="pt-0.5">
                  <CampaignLifecycleActions campaign={campaign} variant="switch" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-slate-400">#{campaign.public_id}</span>
                  <Link
                    className="mt-1 block break-words text-base font-bold !text-slate-900"
                    to={`/tuyendung/app/campaigns/${campaign.public_id}`}
                  >
                    {campaign.name}
                  </Link>
                </div>
              </div>
              <Tag color={CAMPAIGN_STATUS_COLORS[campaign.status]}>
                {CAMPAIGN_STATUS_LABELS[campaign.status]}
              </Tag>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <CampaignCandidateSummary campaign={campaign} />
            </div>
            <div className="mt-4">
              <CampaignJobsSummary
                compact
                campaign={campaign}
                onCreate={() => navigate(
                  `/tuyendung/app/jobs/new?campaign=${campaign.public_id}`,
                )}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {campaign.last_activity?.label || 'Cập nhật'} ·{' '}
              {formatDate(campaign.last_activity?.occurred_at, true)}
            </p>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <CampaignInlineActions campaign={campaign} />
            </div>
          </Card>
        ))}
        {pageData.count > 20 && (
          <div className="flex justify-center">
            <Pagination
              current={page}
              pageSize={20}
              total={pageData.count}
              showSizeChanger={false}
              onChange={(nextPage) => replaceFilters({ page: nextPage })}
            />
          </div>
        )}
      </div>

      <Card className="hidden overflow-hidden border-slate-300 lg:block" styles={{ body: { padding: 0 } }}>
        <Table
          bordered
          rowKey="public_id"
          loading={campaignsQuery.isLoading}
          dataSource={campaigns}
          locale={{ emptyText: <Empty description="Chưa có chiến dịch phù hợp" /> }}
          pagination={{
            current: page,
            pageSize: 20,
            total: pageData.count,
            showSizeChanger: false,
            onChange: (nextPage) => replaceFilters({ page: nextPage }),
          }}
          scroll={{ x: 1100 }}
          onRow={() => ({ className: 'group' })}
          columns={columns}
        />
      </Card>

      <Modal
        destroyOnHidden
        open={createOpen}
        title={(
          <span className="inline-flex items-center gap-2">
            <RocketOutlined className="text-emerald-600" />
            Tạo chiến dịch tuyển dụng
          </span>
        )}
        okText="Tạo chiến dịch"
        cancelText="Hủy"
        okButtonProps={{
          className: '!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !px-5 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!shadow-lg active:!translate-y-0',
        }}
        cancelButtonProps={{
          className: '!h-10 !rounded-xl !border-slate-200 !px-4 !font-semibold !text-slate-600 hover:!border-slate-300 hover:!bg-slate-50 hover:!text-slate-900',
        }}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={({ name }) => createMutation.mutate({ name: name.trim() })}
        >
          <Form.Item
            label="Tên chiến dịch tuyển dụng"
            name="name"
            rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
          >
            <Input
              autoFocus
              maxLength={255}
              placeholder="Ví dụ: Tuyển dụng nhân viên Marketing tháng 10"
              onPressEnter={(event) => {
                if (!event.nativeEvent.isComposing) {
                  event.preventDefault()
                  form.submit()
                }
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        open={Boolean(activityCampaign)}
        title={activityCampaign
          ? `Khởi động chiến dịch: ${activityCampaign.name}`
          : 'Khởi động chiến dịch'}
        onCancel={() => setActivityCampaign(null)}
      >
        <p className="mb-4 text-sm text-slate-500">
          Chiến dịch đã sẵn sàng. Bạn có thể xem chi tiết hoặc đăng tin ngay.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="primary"
            icon={<EyeOutlined aria-hidden />}
            className="!h-11 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!from-emerald-500 hover:!to-teal-500 hover:!shadow-lg active:!translate-y-0"
            onClick={() => navigate(
              `/tuyendung/app/campaigns/${activityCampaign.public_id}`,
            )}
          >
            Xem chiến dịch
          </Button>
          <Button
            icon={<FileAddOutlined aria-hidden />}
            className="!h-11 !rounded-xl !border-slate-200 !bg-white !font-semibold !text-slate-700 !shadow-sm transition-all duration-200 hover:!-translate-y-0.5 hover:!border-emerald-300 hover:!text-emerald-700 hover:!shadow-md active:!translate-y-0"
            onClick={() => navigate(
              `/tuyendung/app/jobs/new?campaign=${activityCampaign.public_id}`,
            )}
          >
            Đăng tin tuyển dụng
          </Button>
        </div>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        open={Boolean(editCampaign)}
        title={(
          <span className="inline-flex items-center gap-2">
            <EditOutlined className="text-emerald-600" />
            Sửa chiến dịch
          </span>
        )}
        onCancel={() => setEditCampaign(null)}
      >
        <CampaignNameForm
          initialName={editCampaign?.name}
          submitting={updateMutation.isPending}
          onCancel={() => setEditCampaign(null)}
          onSubmit={(values) => updateMutation.mutate({
            publicId: editCampaign.public_id,
            values,
          })}
        />
      </Modal>
    </section>
  )
}
