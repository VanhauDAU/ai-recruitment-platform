import {
  CalendarOutlined,
  EditOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Skeleton, Tag, message } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  getCampaign,
  getCampaignReport,
  updateCampaign,
} from '@/entities/campaign'
import {
  CampaignNameForm,
  CampaignLifecycleActions,
} from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignActivityPanel from './CampaignActivityPanel'
import CampaignApplyCvPanel from './CampaignApplyCvPanel'
import CampaignJobsPanel from './CampaignJobsPanel'
import CampaignOverviewPanel from './CampaignOverviewPanel'

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'apply_cv', label: 'CV ứng tuyển' },
  { key: 'job', label: 'Tin tuyển dụng' },
  { key: 'activity', label: 'Lịch sử hoạt động' },
]

const LEGACY_TAB_MAP = {
  applications: 'apply_cv',
  jobs: 'job',
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return includeTime
    ? date.toLocaleString('vi-VN')
    : date.toLocaleDateString('vi-VN')
}

export default function EmployerCampaignWorkspace({ publicId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
    enabled: Boolean(publicId),
  })
  const reportQuery = useQuery({
    queryKey: campaignKeys.report(publicId),
    queryFn: () => getCampaignReport(publicId),
    enabled: Boolean(publicId),
  })
  const updateMutation = useMutation({
    mutationFn: (values) => updateCampaign(publicId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      setEditing(false)
      message.success('Đã cập nhật chiến dịch.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể cập nhật chiến dịch.'),
    ),
  })

  const requestedTab = searchParams.get('active_tab')
    || searchParams.get('tab')
    || 'overview'
  const normalizedTab = LEGACY_TAB_MAP[requestedTab] || requestedTab
  const activeTab = TABS.some((tab) => tab.key === normalizedTab)
    ? normalizedTab
    : 'overview'
  const selectTab = (key) => {
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    next.set('active_tab', key)
    setSearchParams(next)
  }

  if (campaignQuery.isLoading) {
    return <Skeleton active className="mt-3 bg-white p-6" paragraph={{ rows: 12 }} />
  }

  if (campaignQuery.isError) {
    return (
      <Alert
        className="mt-3"
        type="error"
        showIcon
        message="Không thể tải chi tiết chiến dịch"
        description={getApiErrorMessage(campaignQuery.error, 'Vui lòng thử lại sau.')}
        action={(
          <Button size="small" danger onClick={() => campaignQuery.refetch()}>
            Thử lại
          </Button>
        )}
      />
    )
  }

  const campaign = campaignQuery.data
  const report = reportQuery.data || {}

  return (
    <section className="space-y-3 pb-6 pt-3">
      {reportQuery.isError && (
        <Alert
          type="warning"
          showIcon
          closable
          message="Một số chỉ số tổng hợp chưa tải được."
        />
      )}

      <header className="border border-slate-200 bg-white p-4 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-slate-900">{campaign.name}</h1>
              <Tag color={CAMPAIGN_STATUS_COLORS[campaign.status]}>
                {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status_label}
              </Tag>
            </div>
            <p className="mt-1 text-sm text-slate-500">Mã chiến dịch: {campaign.public_id}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span><CalendarOutlined className="mr-1" />Tạo ngày {formatDate(campaign.created_at)}</span>
              <span>
                <HistoryOutlined className="mr-1" />
                Hoạt động gần nhất: {campaign.last_activity?.label || 'Chưa có'}
                {' · '}
                {formatDate(campaign.last_activity?.occurred_at, true)}
              </span>
              <span>
                Sửa thông tin chiến dịch lúc {formatDate(campaign.updated_at, true)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="primary"
              icon={<EditOutlined aria-hidden />}
              className="!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !px-4 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!from-emerald-500 hover:!to-teal-500 hover:!shadow-lg active:!translate-y-0"
              onClick={() => setEditing(true)}
            >
              Sửa chiến dịch
            </Button>
            <CampaignLifecycleActions campaign={campaign} />
          </div>
        </div>
      </header>

      <section className="min-w-0 border border-slate-200 bg-white">
        <div className="overflow-x-auto border-b border-slate-200">
          <div role="tablist" aria-label="Nội dung chiến dịch" className="flex min-w-max px-2">
            {TABS.map((tab) => {
              const selected = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`relative mx-0.5 h-14 whitespace-nowrap rounded-t-xl px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500 ${
                    selected
                      ? 'bg-emerald-50/70 text-emerald-800'
                      : 'text-slate-500 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-emerald-700'
                  }`}
                  onClick={() => selectTab(tab.key)}
                >
                  {tab.label}
                  {selected && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-600 shadow-[0_-2px_8px_rgba(5,150,105,0.28)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div role="tabpanel">
          {activeTab === 'overview' && (
            <CampaignOverviewPanel
              campaign={campaign}
              report={report}
            />
          )}
          {activeTab === 'apply_cv' && <CampaignApplyCvPanel publicId={publicId} />}
          {activeTab === 'job' && <CampaignJobsPanel publicId={publicId} campaign={campaign} />}
          {activeTab === 'activity' && <CampaignActivityPanel publicId={publicId} />}
        </div>
      </section>

      <Modal
        open={editing}
        destroyOnHidden
        footer={null}
        title={(
          <span className="inline-flex items-center gap-2">
            <EditOutlined className="text-emerald-600" />
            Sửa chiến dịch
          </span>
        )}
        onCancel={() => setEditing(false)}
      >
        <CampaignNameForm
          initialName={campaign.name}
          submitting={updateMutation.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Modal>
    </section>
  )
}
