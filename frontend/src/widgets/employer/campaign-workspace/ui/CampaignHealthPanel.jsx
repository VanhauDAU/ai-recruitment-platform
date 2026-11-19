import {
  ClockCircleOutlined,
  EyeOutlined,
  InboxOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { campaignKeys, getCampaignHealth } from '@/entities/campaign/campaign'
import { CampaignReportExport } from '@/features/employer/campaign/export-campaign-report'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import HelpTip from '@/shared/ui/HelpTip'
import { CampaignMetric, CampaignSectionTitle } from './CampaignOverviewCards'
import { getIntlLocale, m } from '@/shared/config/i18n'

const num = (value, digits = 1) => (
  value == null ? '—' : Number(value).toLocaleString(getIntlLocale(), { maximumFractionDigits: digits })
)
const money = (value) => m.employer_campaign_money({ amount: Number(value || 0).toLocaleString(getIntlLocale()) })

const STATUS = {
  achieved: { label: m.employer_campaign_health_status_achieved(), tone: 'good' },
  on_track: { label: m.employer_campaign_health_status_on_track(), tone: 'good' },
  at_risk: { label: m.employer_campaign_health_status_at_risk(), tone: 'warn' },
  off_track: { label: m.employer_campaign_health_status_off_track(), tone: 'bad' },
  insufficient_data: { label: m.employer_campaign_health_status_insufficient_data(), tone: 'muted' },
  no_target: { label: m.employer_campaign_health_status_no_target(), tone: 'muted' },
}

const FUNNEL = [
  ['applied', m.employer_campaign_funnel_applied()],
  ['viewed', m.employer_campaign_funnel_viewed()],
  ['shortlisted', m.employer_campaign_funnel_shortlisted()],
  ['interviewed', m.employer_campaign_funnel_interviewed()],
  ['accepted', m.employer_campaign_funnel_accepted()],
]

function summary(health, campaign) {
  const deadline = campaign.is_continuous || !campaign.target_date
    ? m.employer_campaign_health_deadline_next_30_days()
    : m.employer_campaign_health_deadline_before({ date: dayjs(campaign.target_date).format('DD/MM/YYYY') })
  switch (health.status) {
    case 'no_target':
      return m.employer_campaign_health_summary_no_target()
    case 'insufficient_data':
      return m.employer_campaign_health_summary_insufficient()
    case 'achieved':
      return m.employer_campaign_health_summary_achieved({ accepted: health.accepted, headcount: health.headcount })
    default:
      return m.employer_campaign_health_summary_forecast({ forecast: num(health.forecast), headcount: health.headcount, deadline })
  }
}

function alertItems(health) {
  const items = {
    forecast_at_risk: {
      title: m.employer_campaign_health_alert_forecast_title(),
      text: health.required_velocity == null
        ? m.employer_campaign_health_alert_forecast_slow()
        : m.employer_campaign_health_alert_forecast_text({ required: num(health.required_velocity, 2), current: num(health.velocity_7d, 2) }),
      action: [m.employer_campaign_health_action_add_channel(), '?active_tab=channels'],
    },
    backlog: {
      title: m.employer_campaign_health_alert_backlog_title({ count: health.response.backlog }),
      text: m.employer_campaign_health_alert_backlog_text(),
      action: [m.employer_campaign_health_action_view_cv(), '?active_tab=apply_cv'],
    },
    channel_zero_apply: {
      title: m.employer_campaign_health_alert_silent_title(),
      text: health.silent_channels
        .map((channel) => m.employer_campaign_health_alert_silent_item({ label: channel.label, clicks: channel.clicks }))
        .join(', '),
      action: [m.employer_campaign_health_action_view_channels(), '?active_tab=channels'],
    },
    budget_overburn: {
      title: m.employer_campaign_health_alert_budget_title(),
      text: m.employer_campaign_health_alert_budget_text({ used: num(health.budget.used_percent), ratio: num(health.budget.burn_ratio, 2) }),
      action: [m.employer_campaign_health_action_view_costs(), '?active_tab=channels'],
    },
  }
  return health.alerts.map((key) => ({ key, ...items[key] }))
}

const LEGEND = [
  [m.employer_campaign_health_forecast(), '#059669'],
  [m.employer_campaign_funnel_accepted(), '#7c3aed'],
  [m.employer_campaign_health_target(), '#94a3b8', true],
]

function TrendChart({ history, headcount }) {
  if (history.length < 2) {
    return <p className="cwh-empty">{m.employer_campaign_health_chart_empty()}</p>
  }
  const data = history.map((row) => ({ ...row, day: dayjs(row.date).format('DD/MM') }))
  return (
    <div className="cwh-chart" role="img" aria-label={m.employer_campaign_health_chart_aria({ days: history.length, headcount })}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => num(value)} />
          <Line dataKey="headcount" name={m.employer_campaign_health_target()} stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line dataKey="forecast" name={m.employer_campaign_health_forecast()} stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="accepted" name={m.employer_campaign_funnel_accepted()} stroke="#7c3aed" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ul className="cwh-legend" aria-hidden>
        {LEGEND.map(([label, color, dashed]) => (
          <li key={label}><span style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />{label}</li>
        ))}
      </ul>
    </div>
  )
}

export default function CampaignHealthPanel({ campaign }) {
  const query = useQuery({
    queryKey: campaignKeys.health(campaign.public_id),
    queryFn: () => getCampaignHealth(campaign.public_id),
  })

  if (query.isPending) return <Skeleton active className="rounded-2xl bg-white p-6" paragraph={{ rows: 8 }} />
  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={m.employer_campaign_health_load_error()}
        description={getApiErrorMessage(query.error, m.employer_campaign_try_again_later())}
        action={<Button size="small" onClick={() => query.refetch()}>{m.employer_campaign_retry()}</Button>}
      />
    )
  }

  const { health, history } = query.data
  const status = STATUS[health.status] || STATUS.insufficient_data
  const judged = ['on_track', 'at_risk', 'off_track'].includes(health.status)
  const alerts = alertItems(health)
  const funnel = Object.fromEntries(health.funnel.map((row) => [row.stage, row]))
  const { budget, response } = health

  return (
    <div className="cwh">
      <section className={`cwh-banner is-${status.tone}`} aria-labelledby="cwh-status">
        <div className="min-w-0">
          <p className="cwh-banner__eyebrow">{m.employer_campaign_health_eyebrow()}</p>
          <h2 id="cwh-status" className="cwh-banner__title">
            {status.label}
            <HelpTip label={m.employer_campaign_health_status_help_label()}>
              {m.employer_campaign_health_status_help()}
            </HelpTip>
          </h2>
          <p className="cwh-banner__text">{summary(health, campaign)}</p>
          {judged && health.required_velocity != null && (
            <p className="cwh-banner__text">
              {m.employer_campaign_health_pace_prefix()}
              <strong>{m.employer_campaign_health_per_day({ value: num(health.required_velocity, 2) })}</strong>
              {m.employer_campaign_health_pace_suffix({ value: num(health.velocity_7d, 2) })}
            </p>
          )}
        </div>
        <div className="cwh-banner__side">
          <div className="cwh-score">
            <span>{m.employer_campaign_funnel_accepted()}<HelpTip label={m.employer_campaign_health_hired_help_label()}>{m.employer_campaign_health_hired_help()}</HelpTip></span>
            <strong>{health.accepted}<small>/{health.headcount || '—'}</small></strong>
          </div>
          <CampaignReportExport campaign={campaign} />
        </div>
      </section>

      {alerts.length > 0 && (
        <section aria-labelledby="cwh-alerts" className="cwh-alerts">
          <h2 id="cwh-alerts" className="cwh-alerts__title">{m.employer_campaign_health_alerts_title({ count: alerts.length })}</h2>
          <ul>
            {alerts.map((alert) => (
              <li key={alert.key} className="cwh-alert">
                <div className="min-w-0">
                  <h3>{alert.title}</h3>
                  <p>{alert.text}</p>
                </div>
                <Link to={alert.action[1]}>{alert.action[0]} →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cw-metrics">
        <CampaignMetric icon={RiseOutlined} label={m.employer_campaign_health_velocity_label()} value={num(health.velocity_7d, 2)} hint={m.employer_campaign_health_velocity_hint({ value: num(health.velocity_all, 2) })} help={m.employer_campaign_health_velocity_help()} tone="blue" />
        <CampaignMetric icon={ClockCircleOutlined} label={m.employer_campaign_health_time_to_view_label()} value={response.median_hours_to_view == null ? '—' : m.employer_campaign_health_hours({ hours: num(response.median_hours_to_view) })} hint={m.employer_campaign_health_time_to_view_hint()} help={m.employer_campaign_health_time_to_view_help()} />
        <CampaignMetric icon={EyeOutlined} label={m.employer_campaign_health_viewed_48h_label()} value={response.viewed_within_48h_percent == null ? '—' : `${num(response.viewed_within_48h_percent)}%`} hint={m.employer_campaign_health_viewed_48h_hint()} help={m.employer_campaign_health_viewed_48h_help()} tone="green" />
        <CampaignMetric icon={InboxOutlined} label={m.employer_campaign_health_backlog_label()} value={num(response.backlog, 0)} hint={m.employer_campaign_health_backlog_hint()} help={m.employer_campaign_health_backlog_help()} tone={response.backlog ? 'amber' : 'slate'} />
      </div>

      <div className="cwh-grid">
        <section className="cwh-card">
          <CampaignSectionTitle
            title={<>{m.employer_campaign_health_funnel_title()}<HelpTip label={m.employer_campaign_health_funnel_help_label()}>{m.employer_campaign_health_funnel_help()}</HelpTip></>}
            description={m.employer_campaign_health_funnel_description()}
          />
          <ol className="cwh-funnel">
            {FUNNEL.map(([key, label]) => {
              const row = funnel[key] || { count: 0, percent_of_applications: null }
              return (
                <li key={key}>
                  <span className="cwh-funnel__label">{label}</span>
                  <span className="cwh-funnel__bar"><span style={{ width: `${row.percent_of_applications || 0}%` }} /></span>
                  <span className="cwh-funnel__value">
                    {row.count}
                    {row.percent_of_applications != null && key !== 'applied' && <small> {num(row.percent_of_applications)}%</small>}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="cwh-card">
          <CampaignSectionTitle
            title={<>{m.employer_campaign_health_budget_title()}<HelpTip label={m.employer_campaign_health_budget_help_label()}>{m.employer_campaign_health_budget_help()}</HelpTip></>}
            description={m.employer_campaign_health_budget_description()}
          />
          {budget.budget_max ? (
            <>
              <p className="cwh-budget"><strong>{money(budget.spent)}</strong> / {money(budget.budget_max)}</p>
              <span className="cwh-meter" aria-hidden><span style={{ width: `${Math.min(budget.used_percent || 0, 100)}%` }} className={budget.burn_ratio > 1.2 ? 'is-over' : ''} /></span>
              <p className="cwh-note">
                {m.employer_campaign_health_budget_used({ used: num(budget.used_percent) })}
                {budget.burn_ratio != null && m.employer_campaign_health_budget_burn({ ratio: num(budget.burn_ratio, 2) })}.
              </p>
            </>
          ) : (
            <p className="cwh-empty">{m.employer_campaign_health_budget_empty({ spent: money(budget.spent) })}</p>
          )}
        </section>
      </div>

      <section className="cwh-card">
        <CampaignSectionTitle title={m.employer_campaign_health_trend_title()} description={m.employer_campaign_health_trend_description()} />
        <TrendChart history={history} headcount={health.headcount} />
      </section>

      <details className="cwh-card cwh-formula">
        <summary>{m.employer_campaign_health_formula_summary()}</summary>
        <p>
          {m.employer_campaign_health_formula_text()}
        </p>
        <ul>
          <li>{m.employer_campaign_health_formula_pipeline({ fresh: health.pipeline.new, shortlisted: health.pipeline.shortlisted, interviewed: health.pipeline.interviewed })}</li>
          <li>
            {m.employer_campaign_health_formula_rates({
              fresh: num(health.stage_rates.new * 100),
              shortlisted: num(health.stage_rates.shortlisted * 100),
              interviewed: num(health.stage_rates.interviewed * 100),
            })}
            {Object.values(health.stage_rate_sources).includes('default') && m.employer_campaign_health_formula_rates_default()}.
          </li>
          <li>{m.employer_campaign_health_formula_hire_rate({ rate: num(health.hire_rate * 100) })}</li>
          <li>
            {m.employer_campaign_health_formula_days_left({ count: health.days_left })}
            {campaign.is_continuous ? m.employer_campaign_health_formula_continuous() : ''}
            {m.employer_campaign_health_formula_thresholds()}
          </li>
        </ul>
      </details>
    </div>
  )
}
