import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Empty,
  Segmented,
  Skeleton,
  Statistic,
  Table,
} from 'antd'
import { useMemo, useState } from 'react'
import {
  announcementKeys,
  getAdminAnnouncementMetrics,
} from '@/entities/announcement'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { SURFACE_LABELS } from '../model/announcement-options'

function reportingDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function number(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

export default function AnnouncementMetrics({ publicId }) {
  const [days, setDays] = useState(30)
  const params = useMemo(() => ({
    date_from: reportingDate(-(days - 1)),
    date_to: reportingDate(),
  }), [days])
  const query = useQuery({
    queryKey: announcementKeys.adminMetrics(publicId, params),
    queryFn: ({ signal }) => getAdminAnnouncementMetrics(publicId, params, { signal }),
    enabled: Boolean(publicId),
  })
  const report = query.data
  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      sorter: (left, right) => String(left.date).localeCompare(String(right.date)),
    },
    {
      title: 'Surface',
      dataIndex: 'surface',
      key: 'surface',
      sorter: (left, right) => String(left.surface).localeCompare(String(right.surface)),
      render: (value) => SURFACE_LABELS[value] || value,
    },
    {
      title: 'Hiển thị',
      dataIndex: 'impressions',
      key: 'impressions',
      sorter: (left, right) => left.impressions - right.impressions,
      render: number,
    },
    {
      title: 'Click',
      dataIndex: 'clicks',
      key: 'clicks',
      sorter: (left, right) => left.clicks - right.clicks,
      render: number,
    },
    {
      title: 'CTR',
      dataIndex: 'ctr',
      key: 'ctr',
      sorter: (left, right) => left.ctr - right.ctr,
      render: (value) => `${value.toLocaleString('vi-VN')}%`,
    },
    {
      title: 'Dismiss',
      dataIndex: 'dismisses',
      key: 'dismisses',
      sorter: (left, right) => left.dismisses - right.dismisses,
      render: number,
    },
  ]

  return (
    <section className="announcement-metrics" aria-label="Hiệu quả thông báo">
      <div className="announcement-metrics__toolbar">
        <div>
          <strong>Hiệu quả theo múi giờ Việt Nam</strong>
          <p>Aggregate từ toàn bộ revision, không suy ra từ trang danh sách.</p>
        </div>
        <Segmented
          aria-label="Khoảng báo cáo"
          options={[
            { label: '7 ngày', value: 7 },
            { label: '30 ngày', value: 30 },
            { label: '90 ngày', value: 90 },
          ]}
          value={days}
          onChange={setDays}
        />
      </div>
      {query.isLoading && <Skeleton active paragraph={{ rows: 7 }} />}
      {query.isError && (
        <Alert
          type="error"
          showIcon
          title="Không thể tải số liệu thông báo"
          description={getApiErrorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Thử lại</Button>}
        />
      )}
      {report && (
        <>
          <Alert
            className="announcement-metrics__notice"
            type="info"
            showIcon
            title="Phạm vi số liệu"
            description={report.consent_notice}
          />
          <div className="announcement-metrics__summary">
            <Card><Statistic title="Lượt hiển thị" value={report.summary.impressions} /></Card>
            <Card><Statistic title="Lượt click" value={report.summary.clicks} /></Card>
            <Card><Statistic title="CTR" value={report.summary.ctr} suffix="%" precision={2} /></Card>
            <Card>
              <Statistic
                title="Tỷ lệ dismiss"
                value={report.summary.dismiss_rate}
                suffix="%"
                precision={2}
              />
            </Card>
          </div>
          <Table
            rowKey={(row) => `${row.date}:${row.surface}`}
            columns={columns}
            dataSource={report.daily}
            pagination={{ pageSize: 14, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có event đủ consent trong khoảng này"
                />
              ),
            }}
          />
        </>
      )}
    </section>
  )
}
