import {
  ClockCircleOutlined,
  EyeOutlined,
  InboxOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { campaignKeys, getCampaignHealth } from '@/entities/campaign'
import { CampaignReportExport } from '@/features/export-campaign-report'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import HelpTip from '@/shared/ui/HelpTip'
import { CampaignMetric, CampaignSectionTitle } from './CampaignOverviewCards'

const num = (value, digits = 1) => (
  value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits })
)
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`

const STATUS = {
  achieved: { label: 'Đã đủ chỉ tiêu', tone: 'good' },
  on_track: { label: 'Đúng tiến độ', tone: 'good' },
  at_risk: { label: 'Có rủi ro', tone: 'warn' },
  off_track: { label: 'Chậm tiến độ', tone: 'bad' },
  insufficient_data: { label: 'Chưa đủ dữ liệu', tone: 'muted' },
  no_target: { label: 'Chưa có chỉ tiêu', tone: 'muted' },
}

const FUNNEL = [
  ['applied', 'Ứng tuyển'],
  ['viewed', 'Đã xem'],
  ['shortlisted', 'Phù hợp'],
  ['interviewed', 'Phỏng vấn'],
  ['accepted', 'Trúng tuyển'],
]

function summary(health, campaign) {
  const deadline = campaign.is_continuous || !campaign.target_date
    ? 'trong 30 ngày tới'
    : `trước ${dayjs(campaign.target_date).format('DD/MM/YYYY')}`
  switch (health.status) {
    case 'no_target':
      return 'Gắn tin tuyển dụng vào chiến dịch để có chỉ tiêu (tổng số lượng tuyển của các tin).'
    case 'insufficient_data':
      return 'Cần ít nhất 3 ngày chạy và 5 hồ sơ ứng tuyển để dự báo có ý nghĩa.'
    case 'achieved':
      return `Đã tuyển ${health.accepted}/${health.headcount} người.`
    default:
      return `Dự báo tuyển được khoảng ${num(health.forecast)}/${health.headcount} người ${deadline}.`
  }
}

function alertItems(health) {
  const items = {
    forecast_at_risk: {
      title: 'Dự báo thấp hơn chỉ tiêu',
      text: health.required_velocity == null
        ? 'Hồ sơ đang về chậm hơn mức cần để đủ chỉ tiêu.'
        : `Cần khoảng ${num(health.required_velocity, 2)} CV mỗi ngày, hiện đạt ${num(health.velocity_7d, 2)}.`,
      action: ['Thêm kênh', '?active_tab=channels'],
    },
    backlog: {
      title: `${health.response.backlog} hồ sơ chờ xem quá 48 giờ`,
      text: 'Ứng viên chờ lâu dễ nhận việc nơi khác.',
      action: ['Xem CV', '?active_tab=apply_cv'],
    },
    channel_zero_apply: {
      title: 'Kênh đã đăng nhưng chưa mang về CV',
      text: health.silent_channels
        .map((channel) => `${channel.label} (${channel.clicks} lượt bấm)`)
        .join(', '),
      action: ['Xem kênh', '?active_tab=channels'],
    },
    budget_overburn: {
      title: 'Chi tiêu nhanh hơn tiến độ',
      text: `Đã dùng ${num(health.budget.used_percent)}% ngân sách, nhanh gấp ${num(health.budget.burn_ratio, 2)} lần thời gian đã chạy.`,
      action: ['Xem chi phí', '?active_tab=channels'],
    },
  }
  return health.alerts.map((key) => ({ key, ...items[key] }))
}

const LEGEND = [['Dự báo', '#059669'], ['Trúng tuyển', '#7c3aed'], ['Chỉ tiêu', '#94a3b8', true]]

function TrendChart({ history, headcount }) {
  if (history.length < 2) {
    return <p className="cwh-empty">Biểu đồ xuất hiện sau 2 ngày theo dõi.</p>
  }
  const data = history.map((row) => ({ ...row, day: dayjs(row.date).format('DD/MM') }))
  return (
    <div className="cwh-chart" role="img" aria-label={`Dự báo và số người trúng tuyển trong ${history.length} ngày, chỉ tiêu ${headcount} người`}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => num(value)} />
          <Line dataKey="headcount" name="Chỉ tiêu" stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line dataKey="forecast" name="Dự báo" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="accepted" name="Trúng tuyển" stroke="#7c3aed" strokeWidth={2} dot={false} isAnimationActive={false} />
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
        message="Chưa tải được sức khỏe chiến dịch"
        description={getApiErrorMessage(query.error, 'Vui lòng thử lại sau.')}
        action={<Button size="small" onClick={() => query.refetch()}>Thử lại</Button>}
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
          <p className="cwh-banner__eyebrow">Sức khỏe chiến dịch</p>
          <h2 id="cwh-status" className="cwh-banner__title">
            {status.label}
            <HelpTip label="Giải thích trạng thái sức khỏe">
              Đúng tiến độ: dự báo đạt chỉ tiêu. Có rủi ro: dự báo từ 70% tới dưới chỉ tiêu. Chậm tiến độ: dưới 70%. Cần ít nhất 3 ngày chạy và 5 hồ sơ mới đánh giá.
            </HelpTip>
          </h2>
          <p className="cwh-banner__text">{summary(health, campaign)}</p>
          {judged && health.required_velocity != null && (
            <p className="cwh-banner__text">
              Để kịp chỉ tiêu cần khoảng <strong>{num(health.required_velocity, 2)} CV/ngày</strong>,
              {' '}7 ngày qua đạt {num(health.velocity_7d, 2)} CV/ngày.
            </p>
          )}
        </div>
        <div className="cwh-banner__side">
          <div className="cwh-score">
            <span>Trúng tuyển<HelpTip label="Giải thích số trúng tuyển">Số hồ sơ đã trúng tuyển trên chỉ tiêu (tổng số lượng tuyển của các tin).</HelpTip></span>
            <strong>{health.accepted}<small>/{health.headcount || '—'}</small></strong>
          </div>
          <CampaignReportExport campaign={campaign} />
        </div>
      </section>

      {alerts.length > 0 && (
        <section aria-labelledby="cwh-alerts" className="cwh-alerts">
          <h2 id="cwh-alerts" className="cwh-alerts__title">{alerts.length} điều cần chú ý</h2>
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
        <CampaignMetric icon={RiseOutlined} label="CV mỗi ngày (7 ngày)" value={num(health.velocity_7d, 2)} hint={`Cả đợt: ${num(health.velocity_all, 2)}`} help="Số hồ sơ mới trung bình mỗi ngày trong 7 ngày gần nhất. Cả đợt là trung bình từ ngày bắt đầu chạy, không tính ngày tạm dừng." tone="blue" />
        <CampaignMetric icon={ClockCircleOutlined} label="Thời gian tới lúc xem" value={response.median_hours_to_view == null ? '—' : `${num(response.median_hours_to_view)} giờ`} hint="Trung vị, 30 ngày gần nhất" help="Thời gian từ lúc ứng viên nộp tới lúc bạn mở hồ sơ. Trung vị nghĩa là một nửa số hồ sơ được mở nhanh hơn con số này." />
        <CampaignMetric icon={EyeOutlined} label="Xem trong 48 giờ" value={response.viewed_within_48h_percent == null ? '—' : `${num(response.viewed_within_48h_percent)}%`} hint="Trên hồ sơ nộp từ 48 giờ trước" help="Trong các hồ sơ đã nộp quá 48 giờ, phần trăm được bạn mở trong 48 giờ đầu. Phản hồi nhanh giúp giữ chân ứng viên tốt." tone="green" />
        <CampaignMetric icon={InboxOutlined} label="Chờ xem quá 48 giờ" value={num(response.backlog, 0)} hint="Hồ sơ chưa mở" help="Hồ sơ vẫn ở trạng thái Đã nộp, chưa được mở, sau hơn 48 giờ. Từ 5 hồ sơ trở lên hệ thống sẽ cảnh báo." tone={response.backlog ? 'amber' : 'slate'} />
      </div>

      <div className="cwh-grid">
        <section className="cwh-card">
          <CampaignSectionTitle
            title={<>Phễu tuyển dụng<HelpTip label="Giải thích phễu">Số hồ sơ đã đi tới từng bước, kể cả hồ sơ sau đó bị từ chối. Phần trăm tính trên tổng hồ sơ, nên thấy được bước nào rơi nhiều nhất.</HelpTip></>}
            description="Số hồ sơ đã tới từng bước, tính trên hồ sơ hiện tại."
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
            title={<>Ngân sách<HelpTip label="Giải thích tốc độ chi">Tốc độ chi = % ngân sách đã dùng ÷ % thời gian chiến dịch đã chạy. Bằng 1 là chi đều theo kế hoạch; trên 1,2 là chi nhanh hơn và hệ thống sẽ cảnh báo.</HelpTip></>}
            description="Chi phí nhập theo từng kênh ở tab Kênh & nguồn."
          />
          {budget.budget_max ? (
            <>
              <p className="cwh-budget"><strong>{money(budget.spent)}</strong> / {money(budget.budget_max)}</p>
              <span className="cwh-meter" aria-hidden><span style={{ width: `${Math.min(budget.used_percent || 0, 100)}%` }} className={budget.burn_ratio > 1.2 ? 'is-over' : ''} /></span>
              <p className="cwh-note">
                Đã dùng {num(budget.used_percent)}% ngân sách
                {budget.burn_ratio != null && `, tốc độ chi gấp ${num(budget.burn_ratio, 2)} lần tiến độ thời gian`}.
              </p>
            </>
          ) : (
            <p className="cwh-empty">Đặt ngân sách tối đa trong "Sửa thông tin" để theo dõi mức chi. Đã ghi nhận {money(budget.spent)}.</p>
          )}
        </section>
      </div>

      <section className="cwh-card">
        <CampaignSectionTitle title="Dự báo theo ngày" description="Ảnh chụp mỗi ngày một lần, đường nét đứt là chỉ tiêu." />
        <TrendChart history={history} headcount={health.headcount} />
      </section>

      <details className="cwh-card cwh-formula">
        <summary>Cách tính dự báo</summary>
        <p>
          Dự báo = đã trúng tuyển + hồ sơ đang xử lý × tỷ lệ trúng tuyển theo bước + CV mỗi ngày × số ngày còn lại × tỷ lệ trúng tuyển.
        </p>
        <ul>
          <li>Hồ sơ đang xử lý: {health.pipeline.new} mới, {health.pipeline.shortlisted} phù hợp, {health.pipeline.interviewed} phỏng vấn.</li>
          <li>
            Tỷ lệ theo bước: mới {num(health.stage_rates.new * 100)}%, phù hợp {num(health.stage_rates.shortlisted * 100)}%, phỏng vấn {num(health.stage_rates.interviewed * 100)}%
            {Object.values(health.stage_rate_sources).includes('default') && ' (bước chưa đủ 20 hồ sơ đã có kết quả dùng mức mặc định)'}.
          </li>
          <li>Tỷ lệ trúng tuyển {num(health.hire_rate * 100)}%, làm trơn để chiến dịch ít hồ sơ không bị đoán quá tay.</li>
          <li>Còn {health.days_left} ngày{campaign.is_continuous ? ' (tuyển liên tục: tính 30 ngày tới)' : ''}. Có rủi ro khi dự báo dưới chỉ tiêu, chậm tiến độ khi dưới 70% chỉ tiêu.</li>
        </ul>
      </details>
    </div>
  )
}
