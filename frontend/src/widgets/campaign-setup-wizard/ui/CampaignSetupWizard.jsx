import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, CAMPAIGN_STATUS_LABELS, campaignKeys, getCampaign } from '@/entities/campaign'
import {
  CampaignJobSelection,
  CampaignLaunchReview,
  SETUP_STEPS,
  setupStepStates,
  useCampaignLaunch,
} from '@/features/launch-campaign'
import { CampaignInfoForm } from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import SetupStepRail from './SetupStepRail'
import './campaign-setup-wizard.css'

const STEP_INTRO = {
  goal: ['Thông tin đợt tuyển', 'Đợt tuyển chạy trong bao lâu và dùng bao nhiêu ngân sách. Vị trí, cấp bậc và số người cần tuyển đặt ở từng tin.'],
  jobs: ['Tin tuyển dụng', 'Mỗi tin là một vị trí với cấp bậc và số người cần tuyển riêng. Chỉ tiêu của chiến dịch là tổng số người của các tin.'],
  launch: ['Kích hoạt', 'Kiểm tra lần cuối rồi cho chiến dịch chạy ngay hoặc theo lịch.'],
}

export default function CampaignSetupWizard({ publicId }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
  })
  const launchQuery = useCampaignLaunch(publicId)
  const workspacePath = employerAppPath(`/campaigns/${publicId}`)
  const requested = searchParams.get('step')
  const current = SETUP_STEPS.some((step) => step.key === requested) ? requested : 'goal'
  const goTo = (key) => setSearchParams({ step: key }, { replace: true })

  if (campaignQuery.isLoading || launchQuery.isLoading) {
    return <Skeleton active className="csw-skeleton" paragraph={{ rows: 10 }} />
  }
  const error = campaignQuery.error || launchQuery.error
  if (error) {
    return <Alert className="csw-alert" type="error" showIcon title={getApiErrorMessage(error, 'Không thể tải chiến dịch.')} />
  }
  const campaign = campaignQuery.data
  const overview = launchQuery.data
  const inSetup = CAMPAIGN_SETUP_STATUSES.includes(campaign.status)
  const [title, intro] = STEP_INTRO[current]

  return (
    <section className="csw">
      <Link to={workspacePath} className="csw-back">
        <ArrowLeftOutlined aria-hidden /> Về chiến dịch
      </Link>
      <header className="csw-head">
        <p className="csw-head__kicker">Thiết lập chiến dịch</p>
        <h1 className="csw-head__title">{campaign.name}</h1>
        <span className={`csw-status is-${campaign.status}`}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
      </header>

      {!inSetup ? (
        <Alert
          type="info"
          showIcon
          title="Chiến dịch đã chạy, không còn ở bước thiết lập."
          action={<Button size="small" onClick={() => navigate(workspacePath)}>Mở chiến dịch</Button>}
        />
      ) : (
        <div className="csw-body">
          <SetupStepRail
            steps={SETUP_STEPS}
            states={setupStepStates(campaign, overview)}
            current={current}
            onSelect={goTo}
          />
          <div className="csw-panel">
            <div className="csw-panel__head">
              <h2 className="csw-panel__title">{title}</h2>
              <p className="csw-panel__intro">{intro}</p>
            </div>
            {current === 'goal' && (
              <CampaignInfoForm campaign={campaign} submitLabel="Lưu và tiếp tục" onSaved={() => goTo('jobs')} />
            )}
            {current === 'jobs' && (
              <CampaignJobSelection
                campaign={campaign}
                overview={overview}
                onSaved={() => goTo('launch')}
              />
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
