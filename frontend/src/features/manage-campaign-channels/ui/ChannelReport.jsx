import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import { campaignKeys, getCampaignChannelReport } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import './channel-board.css'

const number = (value) => (value == null ? '—' : Number(value).toLocaleString('vi-VN'))
const money = (value) => (value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`)
const percent = (value) => (value == null ? '—' : `${value.toLocaleString('vi-VN')}%`)

// So sánh hiệu quả từng kênh và các nguồn tự nhiên trên ProCV.
export default function ChannelReport({ campaignId }) {
  const reportQuery = useQuery({
    queryKey: campaignKeys.channelReport(campaignId),
    queryFn: () => getCampaignChannelReport(campaignId),
  })

  if (reportQuery.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (reportQuery.isError) {
    return <Alert type="error" showIcon title={getApiErrorMessage(reportQuery.error, 'Không thể tải báo cáo kênh.')} />
  }
  const { rows, totals } = reportQuery.data

  return (
    <div className="ch-report-wrap">
      <table className="ch-report">
        <thead>
          <tr>
            <th scope="col">Nguồn</th>
            <th scope="col">Người bấm</th>
            <th scope="col">Hồ sơ</th>
            <th scope="col">Tỷ lệ nộp</th>
            <th scope="col">Trúng tuyển</th>
            <th scope="col">Đã chi</th>
            <th scope="col">Chi phí / hồ sơ</th>
            <th scope="col">Chi phí / trúng tuyển</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.kind === 'organic' ? 'is-organic' : ''}>
              <td>
                <span className="ch-report__label">
                  {row.label}
                  {row.kind === 'organic' && <small>Không qua link theo dõi</small>}
                </span>
              </td>
              <td>{number(row.unique_clicks)}</td>
              <td>{number(row.applications)}</td>
              <td>{percent(row.apply_rate)}</td>
              <td>{number(row.hires)}</td>
              <td>{row.kind === 'organic' ? '—' : money(row.cost)}</td>
              <td>{money(row.cost_per_application)}</td>
              <td>{money(row.cost_per_hire)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Tổng</td>
            <td />
            <td>{number(totals.applications)}</td>
            <td />
            <td>{number(totals.hires)}</td>
            <td>
              {money(totals.cost)}
              {totals.budget_used_percent != null && ` (${percent(totals.budget_used_percent)} ngân sách)`}
            </td>
            <td>{money(totals.cost_per_application)}</td>
            <td>{money(totals.cost_per_hire)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
