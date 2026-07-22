import {
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Empty, Skeleton, Table, Tag, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerJobs, jobKeys } from '@/entities/job'

const JOB_STATUS = {
  draft: ['Nháp', 'default'],
  pending: ['Chờ duyệt', 'gold'],
  active: ['Đang tuyển', 'green'],
  closed: ['Đã đóng', 'default'],
  rejected: ['Từ chối', 'red'],
}

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value) {
  if (!value) return 'Không giới hạn'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không giới hạn' : date.toLocaleDateString('vi-VN')
}

function conversionRate(applications, views) {
  const viewCount = numberValue(views)
  if (!viewCount) return '—'
  return `${((numberValue(applications) / viewCount) * 100).toLocaleString('vi-VN', {
    maximumFractionDigits: 1,
  })}%`
}

function JobStatus({ job }) {
  if (job.is_expired) return <Tag color="orange">Hết hạn</Tag>
  const [label, color] = JOB_STATUS[job.status] || [job.status, 'default']
  return <Tag color={color}>{label}</Tag>
}

function ApplicationTrend({ data }) {
  if (!data.length) {
    return (
      <Empty
        className="flex min-h-52 flex-col justify-center"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Chưa có dữ liệu ứng tuyển 7 ngày gần nhất"
      />
    )
  }

  const width = 840
  const height = 220
  const padding = { top: 24, right: 24, bottom: 42, left: 36 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maximum = Math.max(...data.map((item) => numberValue(item.count)), 1)
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth
  const points = data.map((item, index) => ({
    ...item,
    x: padding.left + (index * step),
    y: padding.top + chartHeight - ((numberValue(item.count) / maximum) * chartHeight),
  }))
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[620px]">
        <svg
          role="img"
          aria-label="Biểu đồ lượt ứng tuyển 7 ngày gần nhất"
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full"
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + (chartHeight * ratio)
            const value = Math.round(maximum * (1 - ratio))
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{value}</text>
              </g>
            )
          })}
          <polyline points={polyline} fill="none" stroke="#00b14f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point) => (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#00b14f" strokeWidth="3" />
              <text x={point.x} y={height - 14} textAnchor="middle" fill="#64748b" fontSize="11">
                {new Date(point.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex items-center gap-2 px-9 text-xs text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lượt ứng tuyển
        </div>
      </div>
    </div>
  )
}

function JobActions({ job }) {
  return (
    <div className="flex items-center gap-2">
      <Tooltip title="Xem chi tiết tin">
        <Link
          aria-label={`Xem chi tiết ${job.title || 'tin tuyển dụng'}`}
          to={`/tuyendung/app/jobs/${job.public_id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 !text-slate-600 hover:bg-emerald-50 hover:!text-emerald-700"
        >
          <EyeOutlined />
        </Link>
      </Tooltip>
      {job.status !== 'closed' && (
        <Tooltip title="Chỉnh sửa tin">
          <Link
            aria-label={`Chỉnh sửa ${job.title || 'tin tuyển dụng'}`}
            to={`/tuyendung/app/jobs/${job.public_id}/edit`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 !text-slate-600 hover:bg-emerald-50 hover:!text-emerald-700"
          >
            <EditOutlined />
          </Link>
        </Tooltip>
      )}
    </div>
  )
}

export default function CampaignJobsPanel({ publicId, report = {} }) {
  const params = { campaign: publicId }
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(params),
    queryFn: () => getEmployerJobs(params),
  })
  const jobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : []
  const primaryJob = jobs[0]
  const dailyApplications = Array.isArray(report.daily_applications) ? report.daily_applications : []

  if (jobsQuery.isLoading) return <Skeleton active className="p-6" paragraph={{ rows: 9 }} />

  if (jobsQuery.isError) {
    return (
      <div className="py-16 text-center">
        <FileSearchOutlined className="text-4xl text-slate-300" />
        <p className="mt-3 font-semibold text-slate-700">Không thể tải danh sách tin tuyển dụng</p>
        <button type="button" className="mt-3 text-sm font-semibold text-emerald-700" onClick={() => jobsQuery.refetch()}>Thử lại</button>
      </div>
    )
  }

  if (!jobs.length) {
    return (
      <Empty className="py-20" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chiến dịch chưa có tin tuyển dụng">
        <Link
          to={`/tuyendung/app/jobs/new?campaign=${publicId}`}
          className="inline-flex h-9 items-center rounded bg-emerald-600 px-4 font-semibold !text-white hover:bg-emerald-700"
        >
          <PlusOutlined className="mr-2" /> Đăng tin tuyển dụng
        </Link>
      </Empty>
    )
  }

  return (
    <div className="px-4 py-5 lg:px-5">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-4 text-sm text-slate-700">
        <span className="font-semibold">Báo cáo Tin tuyển dụng:</span>
        <Link to={`/tuyendung/app/jobs/${primaryJob.public_id}`} className="font-semibold !text-emerald-700 hover:underline">
          {primaryJob.title || 'Tin nháp chưa đặt tên'}
        </Link>
        {jobs.length > 1 && <span className="text-slate-400">và {jobs.length - 1} tin khác</span>}
      </div>

      <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex h-8 items-center rounded bg-slate-100 px-3 text-xs font-medium text-slate-600">7 ngày qua</span>
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"><LineChartOutlined /> Cập nhật theo báo cáo chiến dịch</span>
          </div>
          <ApplicationTrend data={dailyApplications} />
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

      <div className="overflow-x-auto border border-slate-200">
        <Table
          rowKey="public_id"
          dataSource={jobs}
          pagination={false}
          scroll={{ x: 1050 }}
          columns={[
            { title: 'Thao tác', width: 100, render: (_, job) => <JobActions job={job} /> },
            {
              title: 'Tin tuyển dụng',
              width: 240,
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
              render: () => <Tooltip title="Hệ thống chưa ghi nhận dữ liệu lượt hiển thị"><span className="text-slate-400">—</span></Tooltip>,
            },
            { title: 'Số lượt xem', dataIndex: 'view_count', align: 'right', render: (value) => numberValue(value).toLocaleString('vi-VN') },
            {
              title: 'Tỷ lệ xem tin',
              align: 'right',
              render: () => <Tooltip title="Cần dữ liệu lượt hiển thị để tính tỷ lệ"><span className="text-slate-400">—</span></Tooltip>,
            },
            {
              title: 'Số lượt ứng tuyển',
              dataIndex: 'application_count',
              align: 'right',
              render: (value, job) => <Link to={`/tuyendung/app/applications?job=${job.public_id}`} className="font-semibold !text-emerald-700">{numberValue(value).toLocaleString('vi-VN')}</Link>,
            },
            {
              title: 'Tỷ lệ ứng tuyển',
              align: 'right',
              render: (_, job) => <strong className="text-slate-700">{conversionRate(job.application_count, job.view_count)}</strong>,
            },
          ]}
        />
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p><InfoCircleOutlined className="mr-1.5" />Số liệu báo cáo không cập nhật theo thời gian thực.</p>
        <p>Hệ thống hiện chưa thu thập số lần hiển thị, vì vậy tỷ lệ xem tin được để trống.</p>
      </div>
    </div>
  )
}
