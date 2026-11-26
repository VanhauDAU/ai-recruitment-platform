import { CalendarOutlined, HistoryOutlined } from '@ant-design/icons'
import { Avatar, Tooltip } from 'antd'
import { Link } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, CAMPAIGN_STATUS_LABELS } from '@/entities/campaign/campaign'
import { m, getIntlLocale } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import dayjs from '@/shared/lib/dayjs'

// Status tones map onto `.ws-tone-*` in @/shared/ui/workspace-list/workspace-list.css.
const STATUS_TONES = {
  active: 'emerald',
  paused: 'amber',
  scheduled: 'sky',
  draft: 'slate',
  completed: 'teal',
  cancelled: 'red',
}

// Job states of a campaign, in the order an owner acts on them.
const JOB_STATES = [
  { key: 'active_job_count', label: m.employer_campaign_jobs_status_active(), tone: 'emerald' },
  { key: 'expired_job_count', label: m.employer_campaign_jobs_expired(), tone: 'orange' },
  { key: 'hidden_job_count', label: m.employer_campaign_jobs_hidden(), tone: 'red' },
  { key: 'draft_job_count', label: m.employer_campaign_jobs_status_draft(), tone: 'slate' },
]

const detailPath = (campaign, suffix = '') => employerAppPath(`/chien-dich/${campaign.public_id}${suffix}`)
const shortDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '')
const count = (value) => Number(value) || 0
const formatCount = (value) => count(value).toLocaleString(getIntlLocale())

function campaignPeriod(campaign) {
  const start = shortDate(campaign.start_date) || m.employer_campaign_list_on_launch()
  const end = campaign.is_continuous
    ? m.employer_campaign_list_continuous()
    : shortDate(campaign.target_date) || m.employer_campaign_list_no_end_date()
  return m.employer_campaign_list_period({ start, end })
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase() || m.employer_campaign_candidates_initials_fallback()
}

// The most useful next step for the row's state; "Xem chi tiết" is always there.
function nextAction(campaign, candidateDataAccess) {
  if (CAMPAIGN_SETUP_STATUSES.includes(campaign.status)) {
    return { label: m.employer_campaign_list_action_setup(), to: detailPath(campaign, '/thiet-lap') }
  }
  const unviewed = count(campaign.unviewed_count ?? campaign.unviewed_application_count)
  if (candidateDataAccess && unviewed > 0) {
    return { label: m.employer_campaign_list_action_view_new_cv({ count: unviewed }), to: detailPath(campaign, '?active_tab=apply_cv') }
  }
  return null
}

// On a narrow list each stat carries its own label; a wide table has a header.
function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

function Jobs({ campaign }) {
  const total = count(campaign.job_count)
  if (!total) return <span className="ws-muted">{m.employer_campaign_hero_no_jobs()}</span>
  const states = JOB_STATES.filter((item) => count(campaign[item.key]) > 0)
  return (
    <>
      <Tooltip title={m.employer_campaign_jobs_summary_headcount({ count: formatCount(campaign.headcount) })}>
        <strong className="ws-strong">{m.employer_campaign_jobs_summary_total({ count: formatCount(total) })}</strong>
      </Tooltip>
      {states.length > 0 && (
        <span className="cpl-states">
          {states.map((item) => (
            <span key={item.key} className={`ws-pill ws-tone-${item.tone}`}>{item.label} {formatCount(campaign[item.key])}</span>
          ))}
        </span>
      )}
    </>
  )
}

function Candidates({ campaign, candidateDataAccess }) {
  const candidates = count(campaign.candidate_count)
  const applications = campaign.application_pair_count ?? campaign.application_submission_count ?? campaign.application_count
  const unviewed = count(campaign.unviewed_count ?? campaign.unviewed_application_count)
  if (!candidates) return <span className="ws-muted">{m.employer_campaign_candidates_none()}</span>
  const previews = candidateDataAccess ? (campaign.candidate_previews || []).slice(0, 3) : []
  return (
    <>
      <span className="cpl-candidates">
        {previews.length > 0 && (
          <span className="cpl-avatars">
            {previews.map((candidate, index) => (
              <Avatar
                key={candidate.public_id}
                size={24}
                src={candidate.avatar_url || undefined}
                title={candidate.full_name}
                className="cpl-avatar"
                style={{ zIndex: previews.length - index }}
              >
                {initials(candidate.full_name)}
              </Avatar>
            ))}
          </span>
        )}
        <strong className="ws-strong">{m.employer_campaign_candidates_count({ count: formatCount(candidates) })}</strong>
        {unviewed > 0 && <span className="ws-pill ws-tone-orange">{m.employer_campaign_list_new_count({ count: formatCount(unviewed) })}</span>}
      </span>
      <span className="ws-caption ws-muted">{m.employer_campaign_candidates_applications({ count: formatCount(applications) })}</span>
    </>
  )
}

function Progress({ campaign }) {
  const hired = count(campaign.accepted_count)
  const target = count(campaign.headcount)
  if (!target) {
    return <span className={hired ? 'ws-strong ws-strong--sm' : 'ws-muted'}>{m.employer_campaign_list_hired_no_target({ count: formatCount(hired) })}</span>
  }
  const percent = Math.min(100, Math.round((hired / target) * 100))
  return (
    <Tooltip title={m.employer_campaign_list_progress_tooltip()}>
      <span className="cpl-progress">
        <span className="ws-strong ws-strong--sm">{m.employer_campaign_list_hired({ hired: formatCount(hired), target: formatCount(target) })}</span>
        <span aria-hidden className="ws-progress">
          <span className={percent >= 100 ? 'is-done' : undefined} style={{ width: `${percent}%` }} />
        </span>
      </span>
    </Tooltip>
  )
}

export default function CampaignListRow({ campaign, candidateDataAccess }) {
  const action = nextAction(campaign, candidateDataAccess)
  const occurredAt = campaign.last_activity?.occurred_at
  return (
    <article data-testid={`campaign-row-${campaign.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <Link className="wt-title" to={detailPath(campaign)}>{campaign.name}</Link>
        <div className="wt-meta">
          <span><CalendarOutlined aria-hidden />{campaignPeriod(campaign)}</span>
          <span>
            <HistoryOutlined aria-hidden />
            <span>
              {campaign.last_activity?.label || m.employer_campaign_list_activity_fallback()}
              {occurredAt && <time className="ws-muted" dateTime={occurredAt}> · {dayjs(occurredAt).format('HH:mm DD/MM/YYYY')}</time>}
            </span>
          </span>
        </div>
      </div>
      <div className="wt-cell wt-cell--status">
        <span className={`ws-pill ws-tone-${STATUS_TONES[campaign.status] || 'slate'}`}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
      </div>
      <Stat label={m.employer_campaign_jobs_col_job()}><Jobs campaign={campaign} /></Stat>
      <Stat label={m.employer_campaign_cv_col_candidate()}>
        <Candidates campaign={campaign} candidateDataAccess={candidateDataAccess} />
      </Stat>
      <Stat label={m.employer_campaign_list_col_progress()}><Progress campaign={campaign} /></Stat>
      <div className="wt-cell wt-cell--actions">
        <div className="wt-actions">
          {action && <Link className="wt-btn wt-btn--primary" to={action.to}>{action.label}</Link>}
          <Link className="wt-btn" to={detailPath(campaign)}>{m.employer_campaign_list_action_open()}</Link>
        </div>
      </div>
    </article>
  )
}
