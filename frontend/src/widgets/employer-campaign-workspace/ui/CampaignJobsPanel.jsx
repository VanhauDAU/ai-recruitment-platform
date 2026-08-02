import {
  EditOutlined,
  ExportOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Modal, Select, Skeleton, Table, Tag, Tooltip } from 'antd'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  campaignKeys,
  getCampaignJobPerformance,
} from '@/entities/campaign'
import { jobDetailPath } from '@/entities/job'
import { employerAppPath } from '@/shared/config/portals'
import CampaignPerformanceChart from './CampaignPerformanceChart'

const JOB_STATUS = {
  draft: ['Nháp', 'default'],
  pending: ['Chờ duyệt', 'gold'],
  active: ['Đang tuyển', 'green'],
  closed: ['Đã đóng', 'default'],
  rejected: ['Từ chối', 'red'],
}

const RANGE_OPTIONS = [
  { value: 7, label: '7 ngày qua' },
  { value: 30, label: '30 ngày qua' },
  { value: 90, label: '90 ngày qua' },
]

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return numberValue(value).toLocaleString('vi-VN')
}

function formatDate(value) {
  if (!value) return 'Không giới hạn'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không giới hạn' : date.toLocaleDateString('vi-VN')
}

function formatRate(value) {
  if (value == null) return '—'
  return `${numberValue(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

function JobStatus({ job, campaignPaused = false }) {
  if (job.is_expired) return <Tag color="orange">Hết hạn</Tag>
  if (campaignPaused && job.status === 'active') {
    return (
      <Tooltip title="Tin đang được ẩn vì chiến dịch đã tạm dừng">
        <Tag color="orange">
          <span className="sr-only">Đang ẩn theo chiến dịch</span>
          <span aria-hidden>Tạm ẩn</span>
        </Tag>
      </Tooltip>
    )
  }
  const [label, color] = JOB_STATUS[job.status] || [job.status, 'default']
  return <Tag color={color}>{label}</Tag>
}

function JobActions({
  job,
  onShowRejectedReason,
  onViewReport,
  reportSelected = false,
  campaignPaused = false,
}) {
  const canViewPublicJob = job.status === 'active' && Boolean(job.slug) && !campaignPaused
  const actionClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white !text-slate-600 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 hover:!text-emerald-700'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Xem báo cáo ${job.title || 'tin tuyển dụng'}`}
        aria-pressed={reportSelected}
        onClick={() => onViewReport(job)}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-sm transition ${reportSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
      >
        <LineChartOutlined />
        {reportSelected ? 'Đang xem' : 'Xem báo cáo'}
      </button>
      <Tooltip
        title={
          canViewPublicJob
            ? 'Xem tin tuyển dụng'
            : campaignPaused
              ? 'Chiến dịch đang tắt'
              : 'Tin chưa công khai'
        }
      >
        <a
          aria-label={`Xem tin ${job.title || 'tin tuyển dụng'}`}
          href={canViewPublicJob ? jobDetailPath(job) : undefined}
          target={canViewPublicJob ? '_blank' : undefined}
          rel={canViewPublicJob ? 'noopener noreferrer' : undefined}
          aria-disabled={!canViewPublicJob}
          onClick={(event) => {
            if (!canViewPublicJob) event.preventDefault()
          }}
          className={`${actionClassName} ${canViewPublicJob ? '' : 'cursor-not-allowed border-slate-200 bg-slate-100 !text-slate-300 hover:border-slate-200 hover:bg-slate-100 hover:!text-slate-300'}`}
        >
          <ExportOutlined />
        </a>
      </Tooltip>
      <Tooltip title="Chỉnh sửa tin">
        <Link
          aria-label={`Chỉnh sửa ${job.title || 'tin tuyển dụng'}`}
          to={employerAppPath(`/jobs/${job.public_id}/edit`)}
          className={actionClassName}
        >
          <EditOutlined />
        </Link>
      </Tooltip>
      {job.status === 'rejected' && (
        <Tooltip title="Xem lý do từ chối">
          <button
            type="button"
            aria-label={`Xem lý do từ chối ${job.title || 'tin tuyển dụng'}`}
            onClick={() => onShowRejectedReason(job)}
            className={actionClassName}
          >
            <InfoCircleOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

function MetricValue({ value, available = true }) {
  if (!available) {
    return <Tooltip title="Khoảng thời gian này chưa có dữ liệu tracking"><span className="text-slate-400">—</span></Tooltip>
  }
  return formatNumber(value)
}

function AddJobButton({ publicId }) {
  return (
    <Link
      to={employerAppPath(`/jobs/new?campaign=${publicId}`)}
      className="inline-flex h-10 shrink-0 items-center rounded-xl px-4 text-sm font-semibold !text-white shadow-md transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
    >
      <PlusOutlined aria-hidden className="mr-2" /> Thêm tin tuyển dụng
    </Link>
  )
}

function PausedCampaignAlert({ campaign }) {
  if (campaign?.status !== 'paused') return null
  return (
    <Alert
      className="mb-4"
      type="warning"
      showIcon
      title="Chiến dịch đang tắt"
      description="Bạn vẫn có thể thêm hoặc chỉnh sửa tin. Các tin đang hoạt động hiện bị ẩn và chỉ công khai trở lại sau khi mở chiến dịch nếu còn hạn."
    />
  )
}

export default function CampaignJobsPanel({ publicId, campaign }) {
  const reportSectionRef = useRef(null)
  const [days, setDays] = useState(7)
  const [jobPublicId, setJobPublicId] = useState('')
  const [status, setStatus] = useState('')
  const [rejectedJob, setRejectedJob] = useState(null)
  const performanceQuery = useQuery({
    queryKey: campaignKeys.jobPerformance(publicId, days, jobPublicId),
    queryFn: () => getCampaignJobPerformance(publicId, days, jobPublicId),
    enabled: Boolean(publicId),
    placeholderData: keepPreviousData,
  })
  const performance = performanceQuery.data
  const jobs = performance?.jobs || []
  const visibleJobs = status === 'expired'
    ? jobs.filter((job) => job.is_expired)
    : status === 'active'
      ? jobs.filter((job) => job.status === status && !job.is_expired)
      : status
        ? jobs.filter((job) => job.status === status)
        : jobs
  const selectedJob = jobs.find((job) => job.public_id === jobPublicId)
  const isReportUpdating = performanceQuery.isFetching && performanceQuery.isPlaceholderData
  const isPeriodUpdating = isReportUpdating && performance?.range?.days !== days
  const viewJobReport = (job) => {
    setJobPublicId(job.public_id)
    reportSectionRef.current?.scrollIntoView?.({ block: 'start' })
  }

  if (performanceQuery.isLoading) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Skeleton active className="pt-5" paragraph={{ rows: 9 }} />
      </div>
    )
  }

  if (performanceQuery.isError) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <div className="py-16 text-center">
          <FileSearchOutlined className="text-4xl text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Không thể tải báo cáo tin tuyển dụng</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {jobPublicId && (
              <button type="button" className="text-sm font-semibold text-slate-600" onClick={() => setJobPublicId('')}>
                Xem tất cả tin
              </button>
            )}
            <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => performanceQuery.refetch()}>Thử lại</button>
          </div>
        </div>
      </div>
    )
  }

  if (!jobs.length) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Empty className="py-20" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chiến dịch chưa có tin tuyển dụng" />
      </div>
    )
  }

  return (
    <div ref={reportSectionRef} className="px-4 py-5 lg:px-5">
      <PausedCampaignAlert campaign={campaign} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 text-sm text-slate-700">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-semibold">Báo cáo Tin tuyển dụng:</span>
            {selectedJob ? (
              <Link to={employerAppPath(`/jobs/${selectedJob.public_id}`)} className="truncate font-semibold !text-emerald-700 hover:underline">
                {selectedJob.title || 'Tin nháp chưa đặt tên'}
              </Link>
            ) : (
              <span className="font-semibold text-emerald-700">Tất cả {jobs.length} tin trong chiến dịch</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {selectedJob
              ? 'Các chỉ số và biểu đồ đang hiển thị riêng tin đã chọn.'
              : `Các chỉ số và biểu đồ đang tổng hợp toàn bộ ${jobs.length} tin tuyển dụng.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedJob && (
            <Button onClick={() => setJobPublicId('')}>
              Xem báo cáo tổng hợp
            </Button>
          )}
          <AddJobButton publicId={publicId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 py-4 lg:grid-cols-5" aria-busy={isReportUpdating}>
        {[
          ['Lượt hiển thị', performance.summary?.impressions],
          ['Lượt xem tin', performance.summary?.views],
          ['Lượt ứng tuyển', performance.summary?.applications],
          ['Tỷ lệ xem', formatRate(performance.summary?.view_rate)],
          ['Tỷ lệ ứng tuyển', formatRate(performance.summary?.application_rate)],
        ].map(([label, value], index) => (
          <article key={label} className={`rounded-xl border border-slate-100 bg-slate-50 p-3.5 ${index === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <strong className="mt-1 block text-lg text-slate-800">
              {isReportUpdating
                ? <Skeleton.Input active size="small" className="!h-6 !w-16" />
                : typeof value === 'number' ? formatNumber(value) : value ?? '—'}
            </strong>
          </article>
        ))}
      </div>

      <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Select
                aria-label="Khoảng thời gian báo cáo"
                data-testid="campaign-performance-range"
                value={days}
                onChange={setDays}
                options={RANGE_OPTIONS}
                className="w-36"
              />
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"><LineChartOutlined /> Số liệu theo ngày</span>
          </div>
          <div aria-busy={isReportUpdating}>
            {isReportUpdating
              ? <Skeleton active title={false} paragraph={{ rows: 6 }} />
              : <CampaignPerformanceChart data={performance.daily || []} />}
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-slate-600">
            <strong className="text-slate-800">48 giờ</strong> là khoảng thời gian lý tưởng để phản hồi ứng viên. Hãy kiểm tra và trả lời ứng viên ngay!
          </p>
          <Link
            to={employerAppPath(`/applications?campaign=${publicId}`)}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-emerald-50 px-3 text-sm font-semibold !text-emerald-700 hover:bg-emerald-100"
          >
            <FileSearchOutlined /> Kiểm tra CV
          </Link>
        </aside>
      </div>

      <div className="mt-1 flex flex-col gap-3 rounded-t-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Hiệu quả theo từng tin</h3>
          <p className="mt-0.5 text-xs text-slate-400">So sánh tất cả tin trong khoảng thời gian báo cáo, độc lập với phạm vi biểu đồ.</p>
        </div>
        <Select
          aria-label="Lọc bảng theo trạng thái"
          value={status}
          onChange={setStatus}
          className="w-full sm:w-40"
          options={[
            { value: '', label: 'Tất cả trạng thái' },
            ...Object.entries(JOB_STATUS).map(([value, [label]]) => ({ value, label })),
            { value: 'expired', label: 'Hết hạn' },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-200" data-testid="campaign-performance-table">
        <Table
          rowKey="public_id"
          dataSource={visibleJobs}
          loading={isPeriodUpdating}
          pagination={false}
          scroll={{ x: 1120 }}
          columns={[
            {
              title: 'Thao tác',
              width: 250,
              render: (_, job) => (
                <JobActions
                  job={job}
                  campaignPaused={campaign?.status === 'paused'}
                  onShowRejectedReason={setRejectedJob}
                  onViewReport={viewJobReport}
                  reportSelected={job.public_id === jobPublicId}
                />
              ),
            },
            {
              title: 'Tin tuyển dụng',
              width: 250,
              render: (_, job) => (
                <div className="min-w-48">
                  <Link className="font-semibold !text-emerald-700 hover:underline" to={employerAppPath(`/jobs/${job.public_id}`)}>{job.title || 'Tin nháp chưa đặt tên'}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><JobStatus job={job} campaignPaused={campaign?.status === 'paused'} /><span className="text-xs text-slate-400">Hạn {formatDate(job.deadline)}</span></div>
                </div>
              ),
            },
            {
              title: 'Số lần hiển thị',
              align: 'right',
              render: (_, job) => <MetricValue value={job.impressions} available={job.available} />,
            },
            {
              title: 'Số lượt xem',
              align: 'right',
              render: (_, job) => <MetricValue value={job.views} available={job.available} />,
            },
            {
              title: <Tooltip title="Số lượt xem / số lần hiển thị × 100"><span>Tỷ lệ xem tin <InfoCircleOutlined /></span></Tooltip>,
              align: 'right',
              render: (_, job) => <strong className="text-slate-700">{formatRate(job.view_rate)}</strong>,
            },
            {
              title: 'Số lượt ứng tuyển',
              align: 'right',
              render: (_, job) => (
                job.available
                  ? <Link to={employerAppPath(`/applications?job=${job.public_id}`)} className="font-semibold !text-emerald-700">{formatNumber(job.applications)}</Link>
                  : <span className="text-slate-400">—</span>
              ),
            },
            {
              title: <Tooltip title="Số lần gửi CV / số lượt xem × 100; có thể lớn hơn 100% khi ứng tuyển lại"><span>Tỷ lệ ứng tuyển <InfoCircleOutlined /></span></Tooltip>,
              align: 'right',
              render: (_, job) => <strong className="text-slate-700">{formatRate(job.application_rate)}</strong>,
            },
          ]}
        />
      </div>

      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
        <p><InfoCircleOutlined className="mr-1.5" />Dữ liệu của phạm vi đã chọn bắt đầu từ {formatDate(performance.data_available_from)}; các ngày trước đó hiển thị “—”, không được coi là 0.</p>
        <p>Chỉ bao gồm lượt hiển thị và lượt xem của người dùng đã đồng ý Analytics. Số lượt ứng tuyển tính mọi lần gửi CV, bao gồm ứng tuyển lại.</p>
        <p>Số liệu có thể có độ trễ ngắn và không cập nhật tức thời.</p>
      </div>
      <Modal
        destroyOnHidden
        open={Boolean(rejectedJob)}
        title="Lý do tin tuyển dụng bị từ chối"
        onCancel={() => setRejectedJob(null)}
        footer={[
          <Button key="close" onClick={() => setRejectedJob(null)}>Đóng</Button>,
          <Button key="edit" type="primary" onClick={() => setRejectedJob(null)} href={rejectedJob ? employerAppPath(`/jobs/${rejectedJob.public_id}/edit`) : undefined}>
            Chỉnh sửa và gửi lại
          </Button>,
        ]}
      >
        <div className="rounded-lg border border-red-100 border-l-4 border-l-red-500 bg-red-50/70 p-4">
          <p className="font-semibold text-red-700">{rejectedJob?.title || 'Tin tuyển dụng'}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {rejectedJob?.rejected_reason?.trim() || 'Quản trị viên chưa cung cấp lý do cụ thể. Vui lòng liên hệ bộ phận hỗ trợ để biết thêm chi tiết.'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
