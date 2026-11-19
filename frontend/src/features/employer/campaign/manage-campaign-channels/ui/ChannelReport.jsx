import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import { campaignKeys, getCampaignChannelReport } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import HelpTip from '@/shared/ui/HelpTip'
import { CHANNEL_METRIC_HELP as HELP } from '../lib/metric-help'
import './channel-board.css'
import { getIntlLocale, m } from '@/shared/config/i18n'

const number = (value) => (value == null ? '—' : Number(value).toLocaleString(getIntlLocale()))
const money = (value) => (value == null ? '—' : m.employer_campaign_money({ amount: Number(value).toLocaleString(getIntlLocale()) }))
const percent = (value) => (value == null ? '—' : `${value.toLocaleString(getIntlLocale())}%`)

// So sánh hiệu quả từng kênh và các nguồn tự nhiên trên ProCV.
export default function ChannelReport({ campaignId }) {
  const reportQuery = useQuery({
    queryKey: campaignKeys.channelReport(campaignId),
    queryFn: () => getCampaignChannelReport(campaignId),
  })

  if (reportQuery.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (reportQuery.isError) {
    return <Alert type="error" showIcon title={getApiErrorMessage(reportQuery.error, m.employer_campaign_report_load_error())} />
  }
  const { rows, totals } = reportQuery.data

  return (
    <div className="ch-report-wrap">
      <table className="ch-report">
        <thead>
          <tr>
            <th scope="col">{m.employer_campaign_report_source()}</th>
            <th scope="col">{m.employer_campaign_report_clickers()}<HelpTip label={m.employer_campaign_report_clickers_help_label()}>{HELP.clicks}</HelpTip></th>
            <th scope="col">{m.employer_campaign_report_applications()}<HelpTip label={m.employer_campaign_report_applications_help_label()}>{HELP.applications}</HelpTip></th>
            <th scope="col">{m.employer_campaign_report_apply_rate()}<HelpTip label={m.employer_campaign_report_apply_rate_help_label()}>{HELP.applyRate}</HelpTip></th>
            <th scope="col">{m.employer_campaign_funnel_accepted()}<HelpTip label={m.employer_campaign_channel_hires_help_label()}>{HELP.hires}</HelpTip></th>
            <th scope="col">{m.employer_campaign_channel_spent()}<HelpTip label={m.employer_campaign_channel_spent_help_label()}>{HELP.spent}</HelpTip></th>
            <th scope="col">{m.employer_campaign_report_cost_per_application()}<HelpTip label={m.employer_campaign_report_cost_per_application_help_label()}>{HELP.costPerApplication}</HelpTip></th>
            <th scope="col">{m.employer_campaign_report_cost_per_hire()}<HelpTip label={m.employer_campaign_report_cost_per_hire_help_label()}>{HELP.costPerHire}</HelpTip></th>
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
                      {m.employer_campaign_report_no_link()}
                      <HelpTip label={m.employer_campaign_report_organic_help_label()}>{m.employer_campaign_report_organic_help()}</HelpTip>
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
            <td>{m.employer_campaign_report_total()}</td>
            <td />
            <td>{number(totals.applications)}</td>
            <td />
            <td>{number(totals.hires)}</td>
            <td>
              {money(totals.cost)}
              {totals.budget_used_percent != null && m.employer_campaign_report_budget_share({ percent: percent(totals.budget_used_percent) })}
            </td>
            <td>{money(totals.cost_per_application)}</td>
            <td>{money(totals.cost_per_hire)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
