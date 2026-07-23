import {
  EditOutlined,
  ExportOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Modal, Select, Skeleton, Table, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  campaignKeys,
  getCampaignJobPerformance,
} from '@/entities/campaign'
import { jobDetailPath } from '@/entities/job'
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

function JobStatus({ job }) {
  if (job.is_expired) return <Tag color="orange">Hết hạn</Tag>
  const [label, color] = JOB_STATUS[job.status] || [job.status, 'default']
  return <Tag color={color}>{label}</Tag>
}

function JobActions({ job, onShowRejectedReason }) {
  const canViewPublicJob = job.status === 'active' && Boolean(job.slug)
  const actionClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white !text-slate-600 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 hover:!text-emerald-700'

  return (
    <div className="flex items-center gap-2">
      <Tooltip title={canViewPublicJob ? 'Xem tin tuyển dụng' : 'Tin chưa công khai'}>
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
          to={`/tuyendung/app/jobs/${job.public_id}/edit`}
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
      to={`/tuyendung/app/jobs/new?campaign=${publicId}`}
      className="inline-flex h-9 shrink-0 items-center rounded px-3 text-sm font-semibold !text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
    >
      <PlusOutlined aria-hidden className="mr-2" /> Thêm tin tuyển dụng
    </Link>
  )
}

export default function CampaignJobsPanel({ publicId }) {
  const [days, setDays] = useState(7)
  const [rejectedJob, setRejectedJob] = useState(null)
  const performanceQuery = useQuery({
    queryKey: campaignKeys.jobPerformance(publicId, days),
    queryFn: () => getCampaignJobPerformance(publicId, days),
    enabled: Boolean(publicId),
  })
  const performance = performanceQuery.data
  const jobs = performance?.jobs || []
  const primaryJob = jobs[0]

  if (performanceQuery.isLoading) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Skeleton active className="pt-5" paragraph={{ rows: 9 }} />
      </div>
    )
  }

  if (performanceQuery.isError) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <div className="py-16 text-center">
          <FileSearchOutlined className="text-4xl text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Không thể tải báo cáo tin tuyển dụng</p>
          <button type="button" className="mt-3 text-sm font-semibold text-emerald-700" onClick={() => performanceQuery.refetch()}>Thử lại</button>
        </div>
      </div>
    )
  }

  if (!jobs.length) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Empty className="py-20" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chiến dịch chưa có tin tuyển dụng" />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 lg:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 text-sm text-slate-700">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-semibold">Báo cáo Tin tuyển dụng:</span>
          <Link to={`/tuyendung/app/jobs/${primaryJob.public_id}`} className="truncate font-semibold !text-emerald-700 hover:underline">
            {primaryJob.title || 'Tin nháp chưa đặt tên'}
          </Link>
          {jobs.length > 1 && <span className="text-slate-400">và {jobs.length - 1} tin khác</span>}
        </div>
        <AddJobButton publicId={publicId} />
      </div>

      <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Select
              aria-label="Khoảng thời gian báo cáo"
              data-testid="campaign-performance-range"
              value={days}
              onChange={setDays}
              options={RANGE_OPTIONS}
              className="w-36"
            />
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"><LineChartOutlined /> Số liệu theo ngày</span>
          </div>
          <CampaignPerformanceChart data={performance.daily || []} />
        </section>

        <aside className="self-start border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-slate-600">
            <strong className="text-slate-800">48 giờ</strong> là khoảng thời gian lý tưởng để phản hồi ứng viên. Hãy kiểm tra và trả lời ứng viên ngay!
          </p>
          <Link
            to={`/tuyendung/app/applications?campaign=${publicId}`}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-emerald-50 px-3 text-sm font-semibold !text-emerald-700 hover:bg-emerald-100"
          >
            <FileSearchOutlined /> Kiểm tra CV
          </Link>
        </aside>
      </div>

      <div className="overflow-x-auto border border-slate-200" data-testid="campaign-performance-table">
        <Table
          rowKey="public_id"
          dataSource={jobs}
          pagination={false}
          scroll={{ x: 1120 }}
          columns={[
            {
              title: 'Thao tác',
              width: 140,
              render: (_, job) => <JobActions job={job} onShowRejectedReason={setRejectedJob} />,
            },
            {
              title: 'Tin tuyển dụng',
              width: 250,
              render: (_, job) => (
                <div className="min-w-48">
                  <Link className="font-semibold !text-emerald-700 hover:underline" to={`/tuyendung/app/jobs/${job.public_id}`}>{job.title || 'Tin nháp chưa đặt tên'}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><JobStatus job={job} /><span className="text-xs text-slate-400">Hạn {formatDate(job.deadline)}</span></div>
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
                  ? <Link to={`/tuyendung/app/applications?job=${job.public_id}`} className="font-semibold !text-emerald-700">{formatNumber(job.applications)}</Link>
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
        <p><InfoCircleOutlined className="mr-1.5" />Dữ liệu bắt đầu từ {formatDate(performance.data_available_from)}; các ngày trước đó hiển thị “—”, không được coi là 0.</p>
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
          <Button key="edit" type="primary" onClick={() => setRejectedJob(null)} href={rejectedJob ? `/tuyendung/app/jobs/${rejectedJob.public_id}/edit` : undefined}>
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
