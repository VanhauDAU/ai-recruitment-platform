import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileTextOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Segmented, Skeleton, Tabs } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  closeEmployerJob,
  extendEmployerJob,
  getEmployerJob,
  getJobPostingContext,
  jobKeys,
  reopenEmployerJob,
  resubmitEmployerJob,
} from '@/entities/job'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  useEmployerReadiness,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import JobApplicationsWorkspace from './JobApplicationsWorkspace'
import JobDetailHeader from './JobDetailHeader'
import JobEngagementPanel from './JobEngagementPanel'
import JobInformationPanel from './JobInformationPanel'
import JobLifecycleModal from './JobLifecycleModal'
import JobVisibilityHoldAlert from './JobVisibilityHoldAlert'
import JobVisibilityIssuesAlert from './JobVisibilityIssuesAlert'
import {
  JOB_DETAIL_TABS,
  applicationSummary,
  deadlineBounds,
  publicJobUrl,
} from './job-detail-presentation'
import { formatCount, jobDisplayTitle } from './job-list-presentation'
import './employer-jobs.css'

const FALLBACK_DEADLINE_POLICY = {
  default_deadline_days: 30,
  max_deadline_days: 90,
  max_public_lifetime_days: 90,
}
const TAB_META = {
  apply_cv: { icon: <TeamOutlined />, label: 'CV ứng tuyển', short: 'Ứng tuyển' },
  viewed_job: { icon: <EyeOutlined />, label: 'Ứng viên đã xem tin', short: 'Lượt xem' },
  job: { icon: <FileTextOutlined />, label: 'Thông tin tuyển dụng', short: 'Thông tin' },
  cv_label: { icon: <TagsOutlined />, label: 'Nhãn', short: 'Nhãn' },
}

function LabelsPanel() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-xl text-violet-600"><TagsOutlined /></span>
      <h2 className="mt-3 text-base font-bold text-slate-800">Nhãn CV sắp ra mắt</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">Bạn sẽ gắn nhãn và lọc ứng viên theo nhãn ngay tại đây.</p>
    </div>
  )
}

function JobDetailSkeleton() {
  return (
    <section className="space-y-4 pb-4 pt-3" aria-label="Đang tải tin tuyển dụng">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Skeleton active title={{ width: '45%' }} paragraph={{ rows: 2, width: ['70%', '40%'] }} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </section>
  )
}

export default function JobDetail() {
  const { publicId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const [deadlineAction, setDeadlineAction] = useState(null)
  const [newDeadline, setNewDeadline] = useState(null)
  const [commitmentAccepted, setCommitmentAccepted] = useState(false)
  const {
    readiness,
    profileQuery,
    isChecking: readinessChecking,
    isAccessError: readinessError,
    canAccessCandidateData,
  } = useEmployerReadiness()
  const requestedTab = searchParams.get('active_tab')
  const activeTab = JOB_DETAIL_TABS.includes(requestedTab) ? requestedTab : 'apply_cv'
  const cvFilter = searchParams.get('cv_filter') || 'all'
  const jobQuery = useQuery({
    queryKey: jobKeys.employerDetail(publicId),
    queryFn: () => getEmployerJob(publicId),
  })
  const postingContextQuery = useQuery({
    queryKey: jobKeys.postingContext,
    queryFn: getJobPostingContext,
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
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đóng tin.')),
  })
  const resubmitMutation = useMutation({
    mutationFn: () => resubmitEmployerJob(publicId),
    onSuccess: () => {
      invalidate()
      message.success('Đã gửi tin cho quản trị viên duyệt lại.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể gửi duyệt lại tin.')),
  })
  const deadlineMutation = useMutation({
    mutationFn: ({ action, deadline, acceptedStatementVersion }) => (
      action === 'reopen'
        ? reopenEmployerJob(publicId, deadline, acceptedStatementVersion)
        : extendEmployerJob(publicId, deadline)
    ),
    onSuccess: () => {
      invalidate()
      setDeadlineAction(null)
      setNewDeadline(null)
      message.success('Đã cập nhật hạn nhận hồ sơ.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể cập nhật hạn nhận hồ sơ.'),
      { id: 'job-deadline-action-error' },
    ),
  })

  function openDeadlineAction(action) {
    setDeadlineAction(action)
    setCommitmentAccepted(false)
    setNewDeadline(jobQuery.data?.deadline ? dayjs(jobQuery.data.deadline) : null)
  }

  function submitDeadlineAction() {
    if (!newDeadline) {
      message.error('Chọn hạn nhận hồ sơ.')
      return
    }
    const deadlineExtended = !jobQuery.data?.deadline
      || newDeadline.isAfter(dayjs(jobQuery.data.deadline), 'day')
    if (deadlineAction === 'extend' && !deadlineExtended) {
      message.error('Hạn gia hạn phải sau hạn nhận hồ sơ hiện tại.')
      return
    }
    const commitment = postingContextQuery.data?.responsibility_statement
    if (deadlineAction === 'reopen' && !(commitment && commitmentAccepted)) {
      message.error('Xác nhận cam kết trước khi mở lại tin.')
      return
    }
    deadlineMutation.mutate({
      action: deadlineAction,
      deadline: newDeadline.format('YYYY-MM-DD'),
      acceptedStatementVersion: deadlineAction === 'reopen' ? commitment.version : undefined,
    })
  }

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next, { replace: true })
  }

  const selectTab = (tab) => updateParams({ active_tab: tab })
  const selectCvFilter = (key) => updateParams({ active_tab: 'apply_cv', cv_filter: key === 'all' ? '' : key })

  if (jobQuery.isLoading) return <JobDetailSkeleton />
  if (jobQuery.isError) {
    const notFound = jobQuery.error?.response?.status === 404
    return (
      <section className="space-y-3 pb-4 pt-3">
        <Link to={employerAppPath('/jobs')} className="inline-flex items-center gap-1.5 text-xs font-medium !text-slate-500 hover:!text-emerald-700">
          <ArrowLeftOutlined aria-hidden /> Tin tuyển dụng
        </Link>
        <Alert
          type="error"
          showIcon
          title={notFound
            ? 'Không tìm thấy tin tuyển dụng này trong tài khoản của bạn.'
            : `Không thể tải tin tuyển dụng. ${getApiErrorMessage(jobQuery.error, 'Vui lòng thử lại sau.')}`}
          action={notFound ? null : <Button size="small" danger onClick={() => jobQuery.refetch()}>Thử lại</Button>}
        />
      </section>
    )
  }
  const job = jobQuery.data
  const summary = applicationSummary(job)
  const bounds = deadlineBounds(job, deadlineAction, postingContextQuery.data || FALLBACK_DEADLINE_POLICY)
  const panels = {
    apply_cv: canAccessCandidateData ? (
      <JobApplicationsWorkspace
        jobPublicId={publicId}
        summary={summary}
        filter={cvFilter}
        onFilterChange={selectCvFilter}
        publicUrl={publicJobUrl(job)}
      />
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
    ),
    viewed_job: <JobEngagementPanel job={job} applicants={summary.total} />,
    job: <JobInformationPanel job={job} />,
    cv_label: <LabelsPanel />,
  }

  return (
    <section className="space-y-3 pb-4 pt-3">
      <JobDetailHeader
        job={job}
        publicId={publicId}
        summary={summary}
        closing={closeMutation.isPending}
        onDeadlineAction={openDeadlineAction}
        onSelectFilter={selectCvFilter}
        onClose={() => requestConfirmation({
          cancelText: 'Đóng',
          confirmText: 'Đóng tin',
          danger: true,
          description: (
            <>
              Bạn có chắc muốn đóng tin tuyển dụng <strong>{jobDisplayTitle(job)}</strong> không?
              <br />
              Tin sẽ ngừng hiển thị với ứng viên.
            </>
          ),
          onConfirm: () => closeMutation.mutateAsync(publicId),
          title: 'Đóng tin tuyển dụng',
        })}
      />

      <JobVisibilityHoldAlert
        hold={job.visibility_hold}
        onResubmit={() => resubmitMutation.mutate()}
        resubmitting={resubmitMutation.isPending}
      />
      <JobVisibilityIssuesAlert job={job} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-2 sm:hidden">
          <Segmented
            block
            aria-label="Chọn nội dung quản lý tin"
            value={activeTab}
            onChange={selectTab}
            options={JOB_DETAIL_TABS.map((key) => ({
              value: key,
              title: TAB_META[key].label,
              label: (
                <span className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold leading-tight">
                  {TAB_META[key].icon}
                  {TAB_META[key].short}
                </span>
              ),
            }))}
          />
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={selectTab}
          className="job-detail-tabs"
          items={JOB_DETAIL_TABS.map((key) => ({
            key,
            label: (
              <span className="inline-flex items-center gap-2">
                {TAB_META[key].icon} {TAB_META[key].label}
                {key === 'apply_cv' && (
                  <span className="job-filter-tab__count">{formatCount(summary.total)}</span>
                )}
              </span>
            ),
            children: panels[key],
          }))}
        />
      </div>

      <JobLifecycleModal
        action={deadlineAction}
        commitment={postingContextQuery.data?.responsibility_statement}
        commitmentAccepted={commitmentAccepted}
        deadline={newDeadline}
        earliestDeadline={bounds.earliest}
        latestDeadline={bounds.latest}
        loading={deadlineMutation.isPending}
        onCancel={() => setDeadlineAction(null)}
        onCommitmentChange={setCommitmentAccepted}
        onDeadlineChange={setNewDeadline}
        onSubmit={submitDeadlineAction}
      />
      {confirmationModal}
    </section>
  )
}
