import { EditOutlined, GlobalOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { Link } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, CAMPAIGN_STATUS_LABELS } from '@/entities/campaign/campaign'
import { CampaignLifecycleActions } from '@/features/employer/campaign/manage-campaigns'
import { employerAppPath } from '@/shared/config/portals'
import HelpTip from '@/shared/ui/HelpTip'
import './campaign-workspace.css'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { explainLabel } from './campaign-overview-options'

const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '')
const money = (value) => m.employer_campaign_money({ amount: Number(value).toLocaleString(getIntlLocale()) })

function campaignFacts(campaign) {
  const end = campaign.is_continuous
    ? m.employer_campaign_list_continuous()
    : formatDate(campaign.target_date) || m.employer_campaign_hero_end_not_set()
  const budget = campaign.budget_max
    ? campaign.budget_min
      ? m.employer_campaign_hero_budget_range({ min: money(campaign.budget_min), max: money(campaign.budget_max) })
      : m.employer_campaign_hero_budget_max({ max: money(campaign.budget_max) })
    : m.employer_campaign_hero_not_set()
  return [
    [
      m.employer_campaign_health_target(),
      campaign.job_count
        ? m.employer_campaign_hero_headcount({ headcount: campaign.headcount, count: campaign.job_count })
        : m.employer_campaign_hero_no_jobs(),
      m.employer_campaign_hero_target_help(),
    ],
    [
      m.employer_campaign_hero_period(),
      m.employer_campaign_list_period({ start: formatDate(campaign.start_date) || m.employer_campaign_list_on_launch(), end }),
    ],
    [m.employer_campaign_health_budget_title(), budget],
    [
      m.employer_campaign_hero_run_days(),
      campaign.active_days == null
        ? m.employer_campaign_hero_not_launched()
        : m.employer_campaign_hero_days({ count: campaign.active_days.toLocaleString(getIntlLocale()) }),
      m.employer_campaign_hero_run_days_help(),
    ],
  ]
}

// Việc chính theo trạng thái; thao tác vòng đời nằm trong menu của CampaignLifecycleActions.
function PrimaryAction({ campaign }) {
  if (CAMPAIGN_SETUP_STATUSES.includes(campaign.status)) {
    return (
      <Link to={employerAppPath(`/campaigns/${campaign.public_id}/setup`)}>
        <Button type="primary" icon={<SettingOutlined aria-hidden />}>
          {campaign.status === 'scheduled' ? m.employer_campaign_hero_view_schedule() : m.employer_campaign_hero_continue_setup()}
        </Button>
      </Link>
    )
  }
  if (campaign.status === 'active') {
    return (
      <Link to={`${employerAppPath('/jobs/new')}?campaign=${campaign.public_id}`}>
        <Button type="primary" icon={<PlusOutlined aria-hidden />}>{m.employer_campaign_hero_post_more()}</Button>
      </Link>
    )
  }
  return null
}

export default function CampaignWorkspaceHero({ campaign, onEdit }) {
  const ended = ['completed', 'cancelled'].includes(campaign.status)

  return (
    <header data-testid="campaign-hero" className="cw-hero">
      <div className="cw-hero__top">
        <div className="cw-hero__heading">
          <div className="cw-hero__badges">
            <span className={`cw-status is-${campaign.status}`}>
              {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status_label || campaign.status}
            </span>
            <span className="cw-hero__id">{campaign.public_id}</span>
            {campaign.slug && campaign.status !== 'draft' && campaign.landing_enabled !== false && (
              <a className="cw-hero__landing" href={`/tuyen-dung/${campaign.slug}`} target="_blank" rel="noreferrer">
                <GlobalOutlined aria-hidden /> {m.employer_campaign_hero_view_landing()}
              </a>
            )}
          </div>
          <h1 className="cw-hero__title">{campaign.name}</h1>
        </div>
        <div className="cw-hero__actions">
          <PrimaryAction campaign={campaign} />
          {!ended && <Button icon={<EditOutlined aria-hidden />} onClick={onEdit}>{m.employer_campaign_hero_edit()}</Button>}
          <CampaignLifecycleActions campaign={campaign} />
        </div>
      </div>
      <dl className="cw-facts">
        {campaignFacts(campaign).map(([label, value, help]) => (
          <div key={label} className="cw-fact">
            <dt>{label}{help && <HelpTip label={explainLabel(label)}>{help}</HelpTip>}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}
