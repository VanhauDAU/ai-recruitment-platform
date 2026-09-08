import {
  AppstoreOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Select, Skeleton } from 'antd'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  campaignKeys,
  getCampaign,
  getCampaignReport,
  updateCampaign,
} from '@/entities/campaign'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  useEmployerReadiness,
} from '@/entities/employer-profile'
import { getJobPostingContext, jobKeys } from '@/entities/job'
import { JobServiceManager } from '@/features/manage-job-services'
import {
  CampaignNameForm,
} from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import CampaignActivityPanel from './CampaignActivityPanel'
import CampaignApplyCvPanel from './CampaignApplyCvPanel'
import CampaignJobsPanel from './CampaignJobsPanel'
import CampaignOverviewPanel from './CampaignOverviewPanel'
import CampaignWorkspaceHero from './CampaignWorkspaceHero'

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: AppstoreOutlined },
  { key: 'apply_cv', label: 'CV ứng tuyển', icon: TeamOutlined },
  { key: 'job', label: 'Tin tuyển dụng', icon: FileTextOutlined },
  { key: 'services', label: 'Dịch vụ', icon: ToolOutlined },
  { key: 'activity', label: 'Lịch sử hoạt động', icon: HistoryOutlined },
]

const LEGACY_TAB_MAP = {
  applications: 'apply_cv',
  jobs: 'job',
}

function valueOrZero(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function EmployerCampaignWorkspace({ publicId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const tabRefs = useRef([])
  const queryClient = useQueryClient()
  const {
    readiness,
    profileQuery,
    isChecking: readinessChecking,
    isAccessError: readinessError,
    canAccessCandidateData,
  } = useEmployerReadiness()
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
  const postingContextQuery = useQuery({
    queryKey: jobKeys.postingContext,
    queryFn: getJobPostingContext,
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
  const tabCounts = {
    apply_cv: valueOrZero(
      report.application_pair_count
      ?? campaign.application_pair_count
      ?? campaign.application_count,
    ),
    job: valueOrZero(report.jobs?.total ?? campaign.job_count),
  }
  const moveTabFocus = (event, index) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const lastIndex = TABS.length - 1
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowRight'
          ? (index + 1) % TABS.length
          : (index - 1 + TABS.length) % TABS.length
    selectTab(TABS[nextIndex].key)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section className="space-y-4 pb-8 pt-3">
      {reportQuery.isError && (
        <Alert
          type="warning"
          showIcon
          closable
          message="Một số chỉ số tổng hợp chưa tải được."
        />
      )}

      <CampaignWorkspaceHero campaign={campaign} onEdit={() => setEditing(true)} />

      <section className="min-w-0">
        <div className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="sm:hidden">
            <Select
              aria-label="Chọn nội dung chiến dịch"
              value={activeTab}
              className="w-full"
              popupMatchSelectWidth
              options={TABS.map((tab) => ({
                value: tab.key,
                label: tabCounts[tab.key] == null
                  ? tab.label
                  : `${tab.label} (${tabCounts[tab.key]})`,
              }))}
              onChange={selectTab}
            />
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <div role="tablist" aria-label="Nội dung chiến dịch" className="flex min-w-max gap-1">
              {TABS.map((tab, index) => {
                const selected = tab.key === activeTab
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    ref={(node) => { tabRefs.current[index] = node }}
                    id={`campaign-tab-${tab.key}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`campaign-panel-${tab.key}`}
                    aria-label={tab.label}
                    tabIndex={selected ? 0 : -1}
                    className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                      selected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-700'
                    }`}
                    onClick={() => selectTab(tab.key)}
                    onKeyDown={(event) => moveTabFocus(event, index)}
                  >
                    <Icon aria-hidden />
                    {tab.label}
                    {tabCounts[tab.key] != null && (
                      <span
                        aria-hidden
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${selected ? 'bg-white text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div
          id={`campaign-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`campaign-tab-${activeTab}`}
          className={activeTab === 'overview'
            ? 'mt-4'
            : 'mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'}
        >
          {activeTab === 'overview' && (
            <CampaignOverviewPanel
              campaign={campaign}
              report={report}
              reportLoading={reportQuery.isLoading}
            />
          )}
          {activeTab === 'apply_cv' && (canAccessCandidateData ? (
            <CampaignApplyCvPanel publicId={publicId} />
          ) : (
            <div className="p-4 sm:p-5">
              <EmployerReadinessGateState
                compact
                capability={EMPLOYER_CAPABILITIES.CANDIDATE_DATA}
                checking={readinessChecking}
                error={readinessError}
                readiness={readiness}
                onRetry={profileQuery.refetch}
              />
            </div>
          ))}
          {activeTab === 'job' && (
            <CampaignJobsPanel
              publicId={publicId}
              campaign={campaign}
              candidateDataAccess={canAccessCandidateData}
            />
          )}
          {activeTab === 'services' && (
            <div className="p-4 sm:p-5">
              <JobServiceManager
                campaignPublicId={publicId}
                activationEnabled={postingContextQuery.data?.services?.activation_enabled === true}
                refreshEnabled={postingContextQuery.data?.services?.refresh_enabled === true}
                alertEnabled={postingContextQuery.data?.services?.alert_enabled === true}
                metricsEnabled={postingContextQuery.data?.services?.metrics_enabled === true}
                showInventory={false}
              />
            </div>
          )}
          {activeTab === 'activity' && (canAccessCandidateData ? (
            <CampaignActivityPanel publicId={publicId} />
          ) : (
            <div className="p-4 sm:p-5">
              <EmployerReadinessGateState
                compact
                capability={EMPLOYER_CAPABILITIES.CANDIDATE_DATA}
                checking={readinessChecking}
                error={readinessError}
                readiness={readiness}
                onRetry={profileQuery.refetch}
              />
            </div>
          ))}
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
