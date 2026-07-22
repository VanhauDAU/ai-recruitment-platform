import {
  ArrowLeftOutlined,
  EditOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Popconfirm, Skeleton, Tabs, Tag, message } from 'antd'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  changeCampaignStatus,
  getCampaign,
  getCampaignReport,
  updateCampaign,
} from '@/entities/campaign'
import { getJobCategories } from '@/entities/job'
import { CampaignForm } from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignApplicationsPanel from './CampaignApplicationsPanel'
import CampaignJobsPanel from './CampaignJobsPanel'
import CampaignOverview from './CampaignOverview'

export default function CampaignDetail() {
  const { publicId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editing = searchParams.get('edit') === '1'
  const activeTab = searchParams.get('tab') || 'overview'
  const campaignQuery = useQuery({ queryKey: campaignKeys.detail(publicId), queryFn: () => getCampaign(publicId) })
  const reportQuery = useQuery({ queryKey: campaignKeys.report(publicId), queryFn: () => getCampaignReport(publicId) })
  const categoriesQuery = useQuery({ queryKey: ['jobs', 'categories', 'specialization'], queryFn: () => getJobCategories({ category_type: 'specialization' }), enabled: editing })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.detail(publicId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.report(publicId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  }
  const updateMutation = useMutation({
    mutationFn: (payload) => updateCampaign(publicId, payload),
    onSuccess: () => { invalidate(); setSearchParams({ tab: activeTab }); message.success('Đã cập nhật chiến dịch.') },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật chiến dịch.')),
  })
  const statusMutation = useMutation({
    mutationFn: (status) => changeCampaignStatus(publicId, status),
    onSuccess: (_, status) => { invalidate(); message.success(status === 'active' ? 'Đã mở lại chiến dịch.' : 'Đã dừng chiến dịch.') },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đổi trạng thái chiến dịch.')),
  })

  if (campaignQuery.isLoading || reportQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (campaignQuery.isError || reportQuery.isError) return <Alert type="error" showIcon title="Không thể tải chiến dịch." />
  const campaign = campaignQuery.data
  const report = reportQuery.data
  const canResume = ['draft', 'paused', 'completed'].includes(campaign.status)
  const setTab = (tab) => setSearchParams({ tab })

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Link to="/tuyendung/app/campaigns" className="mb-3 inline-flex items-center gap-2 text-sm !text-slate-500 hover:!text-emerald-700"><ArrowLeftOutlined /> Quay lại danh sách</Link>
            <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-extrabold text-slate-900">{campaign.name}</h1><Tag color={CAMPAIGN_STATUS_COLORS[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Tag></div>
            <p className="mt-1 text-sm text-slate-500">#{campaign.public_id} · {campaign.description || 'Workspace quản lý tin tuyển dụng và hồ sơ của mục tiêu này.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<TeamOutlined />} onClick={() => navigate(`/tuyendung/app/applications?campaign=${publicId}`)}>Quản lý CV</Button>
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate(`/tuyendung/app/jobs/new?campaign=${publicId}`)}>Đăng tin</Button>
            <Button icon={<EditOutlined />} onClick={() => setSearchParams({ tab: activeTab, edit: '1' })}>Chỉnh sửa</Button>
            {campaign.status === 'active' && <Popconfirm title="Dừng chiến dịch?" description="Tin tuyển dụng đang chạy không tự động bị đóng." okText="Dừng" cancelText="Hủy" onConfirm={() => statusMutation.mutate('paused')}><Button icon={<PauseCircleOutlined />}>Dừng</Button></Popconfirm>}
            {canResume && <Button icon={<PlayCircleOutlined />} onClick={() => statusMutation.mutate('active')}>Mở lại</Button>}
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Tổng quan', children: <CampaignOverview report={report} /> },
          { key: 'applications', label: `CV ứng tuyển (${report.applications?.total || 0})`, children: activeTab === 'applications' ? <CampaignApplicationsPanel publicId={publicId} /> : null },
          { key: 'jobs', label: `Tin tuyển dụng (${report.jobs?.total || 0})`, children: activeTab === 'jobs' ? <CampaignJobsPanel publicId={publicId} /> : null },
        ]}
      />

      <Modal open={editing} title="Chỉnh sửa chiến dịch" footer={null} width={760} onCancel={() => setSearchParams({ tab: activeTab })}>
        <CampaignForm initialValues={campaign} categories={categoriesQuery.data || []} submitting={updateMutation.isPending} onSubmit={(payload) => updateMutation.mutate(payload)} onCancel={() => setSearchParams({ tab: activeTab })} />
      </Modal>
    </section>
  )
}
