import {
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, DatePicker, Modal, Select, Skeleton, Tabs, message } from 'antd'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  applicationKeys,
  getRecruiterApplications,
} from '@/entities/application'
import {
  closeEmployerJob,
  extendEmployerJob,
  getEmployerJob,
  jobKeys,
  reopenEmployerJob,
} from '@/entities/job'
import JobApplicationsWorkspace from './JobApplicationsWorkspace'
import JobDetailHeader from './JobDetailHeader'
import JobInformationPanel from './JobInformationPanel'

const CONNECTED_STATUSES = new Set(['considering', 'shortlisted', 'interviewed', 'accepted'])
const VALID_TABS = new Set(['apply_cv', 'viewed_job', 'job', 'cv_label'])
const EMPTY_APPLICATIONS = []

function MetricCard({ icon, label, value, helper, tone = 'emerald', testId }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <article data-testid={testId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-slate-400" title={helper}>{helper}</p>
    </article>
  )
}

function ViewedCandidatesPanel({ viewCount }) {
  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-600"><EyeOutlined /></span>
        <h2 className="mt-4 text-base font-bold text-slate-800">Dữ liệu lượt xem tin tuyển dụng</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Hệ thống hiện ghi nhận lượt xem tổng hợp và không lưu danh tính ứng viên chỉ xem tin nhưng chưa ứng tuyển.
        </p>
      </div>
      <aside className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-700">Tổng lượt xem</p>
        <p className="mt-2 text-4xl font-black text-blue-700">{viewCount || 0}</p>
        <p className="mt-2 text-xs leading-5 text-blue-600">Số liệu được cập nhật từ thống kê của tin tuyển dụng.</p>
      </aside>
    </div>
  )
}

function LabelsPanel() {
  return (
    <div className="p-4 sm:p-5">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl text-violet-600"><TagsOutlined /></span>
        <h2 className="mt-4 font-bold text-slate-800">Nhãn quản lý CV đang được hoàn thiện</h2>
        <p className="mt-2 text-sm text-slate-500">Khi tính năng được mở, bạn có thể phân nhóm và lọc ứng viên theo nhãn ngay tại đây.</p>
        <span className="mt-4 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Sắp mở</span>
      </div>
    </div>
  )
}

export default function JobDetail() {
  const { publicId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [deadlineAction, setDeadlineAction] = useState(null)
  const [newDeadline, setNewDeadline] = useState(null)
  const requestedTab = searchParams.get('active_tab')
  const activeTab = VALID_TABS.has(requestedTab) ? requestedTab : 'apply_cv'
  const jobQuery = useQuery({
    queryKey: jobKeys.employerDetail(publicId),
    queryFn: () => getEmployerJob(publicId),
  })
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList({ job: publicId }),
    queryFn: () => getRecruiterApplications({ job: publicId }),
  })
  const applications = applicationsQuery.data || EMPTY_APPLICATIONS
  const metrics = useMemo(() => ({
    total: applicationsQuery.isLoading ? (jobQuery.data?.application_count || 0) : applications.length,
    applied: applications.filter((item) => item.source === 'applied').length,
    connected: applications.filter((item) => CONNECTED_STATUSES.has(item.status)).length,
  }), [applications, applicationsQuery.isLoading, jobQuery.data?.application_count])

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

  function selectTab(tab) {
    const next = new URLSearchParams(searchParams)
    next.set('active_tab', tab)
    setSearchParams(next, { replace: true })
  }

  if (jobQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />
  if (jobQuery.isError) return <Alert type="error" showIcon title="Không thể tải tin tuyển dụng." />
  const job = jobQuery.data

  const tabs = [
    {
      key: 'apply_cv',
      label: <span className="inline-flex items-center gap-2"><TeamOutlined /> CV ứng tuyển <strong>{metrics.applied}</strong></span>,
      children: <JobApplicationsWorkspace jobPublicId={publicId} applications={applications} loading={applicationsQuery.isLoading} />,
    },
    {
      key: 'viewed_job',
      label: <span className="inline-flex items-center gap-2"><EyeOutlined /> Ứng viên đã xem tin</span>,
      children: <ViewedCandidatesPanel viewCount={job.view_count} />,
    },
    {
      key: 'job',
      label: <span className="inline-flex items-center gap-2"><FileTextOutlined /> Thông tin tuyển dụng</span>,
      children: <JobInformationPanel job={job} />,
    },
    {
      key: 'cv_label',
      label: <span className="inline-flex items-center gap-2"><TagsOutlined /> Nhãn</span>,
      children: <LabelsPanel />,
    },
  ]

  return (
    <section className="mx-auto max-w-[1320px] space-y-4 pb-4">
      <JobDetailHeader
        job={job}
        publicId={publicId}
        closing={closeMutation.isPending}
        onClose={() => closeMutation.mutate(publicId)}
        onDeadlineAction={openDeadlineAction}
      />

      {job.status === 'pending' && (
        <Alert type="info" showIcon title="Tin đang chờ quản trị viên duyệt" description="Tin chưa hiển thị với ứng viên cho đến khi được duyệt." />
      )}
      {job.status === 'rejected' && (
        <Alert type="error" showIcon title="Tin tuyển dụng bị từ chối" description={job.rejected_reason || 'Quản trị viên chưa cung cấp lý do.'} />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard testId="job-metric-total-cvs" icon={<TeamOutlined />} label="Tổng lượng CV ứng viên" value={metrics.total} helper="Tất cả nguồn CV của tin" />
        <MetricCard testId="job-metric-applied-cvs" icon={<FileTextOutlined />} label="CV ứng tuyển" value={metrics.applied} helper="Ứng viên chủ động nộp CV" tone="blue" />
        <MetricCard testId="job-metric-connected-cvs" icon={<LinkOutlined />} label="CV đã kết nối" value={metrics.connected} helper="Cân nhắc, phù hợp hoặc đã phỏng vấn" tone="violet" />
        <MetricCard testId="job-metric-views" icon={<EyeOutlined />} label="Lượt xem tin" value={job.view_count || 0} helper="Tổng lượt xem được ghi nhận" tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3 sm:hidden">
          <Select
            aria-label="Chọn nội dung quản lý tin"
            value={activeTab}
            className="!w-full"
            options={[
              { value: 'apply_cv', label: `CV ứng tuyển (${metrics.applied})` },
              { value: 'viewed_job', label: 'Ứng viên đã xem tin' },
              { value: 'job', label: 'Thông tin tuyển dụng' },
              { value: 'cv_label', label: 'Nhãn' },
            ]}
            onChange={selectTab}
          />
        </div>
        <Tabs
          activeKey={activeTab}
          items={tabs}
          onChange={selectTab}
          className="job-detail-tabs [&_.ant-tabs-content-holder]:min-w-0 [&_.ant-tabs-nav]:!hidden sm:[&_.ant-tabs-nav]:!mb-0 sm:[&_.ant-tabs-nav]:!flex sm:[&_.ant-tabs-nav]:px-5 [&_.ant-tabs-tab]:!py-4"
        />
      </div>

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
