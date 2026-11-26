import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, CAMPAIGN_STATUS_LABELS, campaignKeys, getCampaign } from '@/entities/campaign/campaign'
import {
  CampaignJobSelection,
  CampaignLaunchReview,
  SETUP_STEPS,
  setupStepStates,
  useCampaignLaunch,
} from '@/features/employer/campaign/launch-campaign'
import { CampaignChannelBoard, useCampaignChannels } from '@/features/employer/campaign/manage-campaign-channels'
import { CampaignInfoForm } from '@/features/employer/campaign/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import SetupStepRail from './SetupStepRail'
import './campaign-setup-wizard.css'

const STEP_INTRO = {
  goal: [m.employer_campaign_setup_goal_title(), m.employer_campaign_setup_goal_intro()],
  channels: [m.employer_campaign_step_channels(), m.employer_campaign_setup_channels_intro()],
  jobs: [m.employer_campaign_step_jobs(), m.employer_campaign_setup_jobs_intro()],
  launch: [m.employer_campaign_step_launch(), m.employer_campaign_setup_launch_intro()],
}

const NEW_CAMPAIGN = { name: '', status: 'draft', budget_source: 'company', is_continuous: false }
const EMPTY_OVERVIEW = { draft_jobs: [], attachable_jobs: [], campaign_jobs: [], check: null }

export default function CampaignSetupWizard({ publicId }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isNew = !publicId
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
    enabled: !isNew,
  })
  const launchQuery = useCampaignLaunch(publicId)
  const channelsQuery = useCampaignChannels(publicId)
  const workspacePath = isNew ? employerAppPath('/chien-dich') : employerAppPath(`/chien-dich/${publicId}`)
  const requested = searchParams.get('step')
  const current = !isNew && SETUP_STEPS.some((step) => step.key === requested) ? requested : 'goal'
  const goTo = (key) => setSearchParams({ step: key }, { replace: true })
  const handleInfoSaved = (saved) => (isNew
    ? navigate(employerAppPath(`/chien-dich/${saved.public_id}/thiet-lap?step=jobs`), { replace: true })
    : goTo('jobs'))

  if (!isNew && (campaignQuery.isLoading || launchQuery.isLoading)) {
    return <Skeleton active className="csw-skeleton" paragraph={{ rows: 10 }} />
  }
  const error = !isNew && (campaignQuery.error || launchQuery.error)
  if (error) {
    return <Alert className="csw-alert" type="error" showIcon title={getApiErrorMessage(error, m.employer_campaign_setup_load_error())} />
  }
  const campaign = isNew ? NEW_CAMPAIGN : campaignQuery.data
  const overview = isNew ? EMPTY_OVERVIEW : launchQuery.data
  const inSetup = CAMPAIGN_SETUP_STATUSES.includes(campaign.status)
  const [title, intro] = STEP_INTRO[current]

  return (
    <section className="csw">
      <Link to={workspacePath} className="csw-back">
        <ArrowLeftOutlined aria-hidden /> {isNew ? m.employer_campaign_setup_back_to_list() : m.employer_campaign_setup_back_to_campaign()}
      </Link>
      <header className="csw-head">
        <p className="csw-head__kicker">{isNew ? m.employer_campaign_setup_kicker_new() : m.employer_campaign_setup_kicker()}</p>
        <h1 className="csw-head__title">{campaign.name || m.employer_campaign_setup_title_new()}</h1>
        {!isNew && <span className={`csw-status is-${campaign.status}`}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</span>}
      </header>

      {!inSetup ? (
        <Alert
          type="info"
          showIcon
          title={m.employer_campaign_setup_not_in_setup()}
          action={<Button size="small" onClick={() => navigate(workspacePath)}>{m.employer_campaign_setup_open_campaign()}</Button>}
        />
      ) : (
        <div className="csw-body">
          <SetupStepRail
            steps={SETUP_STEPS}
            states={setupStepStates(campaign, overview, channelsQuery.data?.length || 0)}
            current={current}
            onSelect={goTo}
            locked={isNew}
          />
          <div className="csw-panel">
            <div className="csw-panel__head">
              <h2 className="csw-panel__title">{title}</h2>
              <p className="csw-panel__intro">{intro}</p>
            </div>
            {current === 'goal' && (
              <CampaignInfoForm
                campaign={campaign}
                submitLabel={isNew ? m.employer_campaign_setup_create_and_continue() : m.employer_campaign_save_and_continue()}
                onSaved={handleInfoSaved}
              />
            )}
            {current === 'jobs' && (
              <CampaignJobSelection
                campaign={campaign}
                overview={overview}
                onSaved={() => goTo('channels')}
              />
            )}
            {current === 'channels' && (
              <div className="csw-channels">
                <CampaignChannelBoard campaign={campaign} />
                <div className="csw-next">
                  <Button type="primary" onClick={() => goTo('launch')}>{m.employer_campaign_setup_continue()}</Button>
                </div>
              </div>
            )}
            {current === 'launch' && (
              <CampaignLaunchReview
                campaign={campaign}
                overview={overview}
                onGoToStep={goTo}
                onLaunched={() => navigate(workspacePath)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
