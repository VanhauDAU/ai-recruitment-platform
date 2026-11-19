import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import { campaignKeys, getCampaignChannelReport } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import HelpTip from '@/shared/ui/HelpTip'
import { CHANNEL_METRIC_HELP as HELP } from '../lib/metric-help'
import './channel-board.css'
import { getIntlLocale } from '@/shared/config/i18n'

const number = (value) => (value == null ? '—' : Number(value).toLocaleString(getIntlLocale()))
const money = (value) => (value == null ? '—' : `${Number(value).toLocaleString(getIntlLocale())} đ`)
const percent = (value) => (value == null ? '—' : `${value.toLocaleString(getIntlLocale())}%`)

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
            <th scope="col">Người bấm<HelpTip label="Giải thích người bấm">{HELP.clicks}</HelpTip></th>
            <th scope="col">Hồ sơ<HelpTip label="Giải thích hồ sơ">{HELP.applications}</HelpTip></th>
            <th scope="col">Tỷ lệ nộp<HelpTip label="Giải thích tỷ lệ nộp">{HELP.applyRate}</HelpTip></th>
            <th scope="col">Trúng tuyển<HelpTip label="Giải thích trúng tuyển">{HELP.hires}</HelpTip></th>
            <th scope="col">Đã chi<HelpTip label="Giải thích đã chi">{HELP.spent}</HelpTip></th>
            <th scope="col">Chi phí / hồ sơ<HelpTip label="Giải thích chi phí / hồ sơ">{HELP.costPerApplication}</HelpTip></th>
            <th scope="col">Chi phí / trúng tuyển<HelpTip label="Giải thích chi phí / trúng tuyển">{HELP.costPerHire}</HelpTip></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.kind === 'organic' ? 'is-organic' : ''}>
              <td>
                <span className="ch-report__label">
                  {row.label}
                  {row.kind === 'organic' && (
                    <small>
                      Không qua link theo dõi
                      <HelpTip label="Giải thích nguồn tự nhiên">Hồ sơ ứng viên tự tìm thấy trên ProCV, được gợi ý hoặc được mời từ kho ứng viên. Không có link nên không đếm được người bấm và không có chi phí.</HelpTip>
                    </small>
                  )}
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
