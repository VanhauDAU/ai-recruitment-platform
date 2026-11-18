import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton, Steps } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, campaignKeys, getCampaign } from '@/entities/campaign'
import { CampaignJobSelection, CampaignLaunchReview, useCampaignLaunch } from '@/features/launch-campaign'
import { CampaignGoalForm } from '@/features/manage-campaigns'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'

const STEPS = [
  { key: 'goal', title: 'Mục tiêu' },
  { key: 'jobs', title: 'Tin tuyển dụng' },
  { key: 'launch', title: 'Xem lại & kích hoạt' },
]

export default function CampaignSetupWizard({ publicId }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
  })
  const launchQuery = useCampaignLaunch(publicId)
  const workspacePath = employerAppPath(`/campaigns/${publicId}`)
  const stepIndex = Math.max(0, STEPS.findIndex((step) => step.key === searchParams.get('step')))
  const goTo = (index) => setSearchParams({ step: STEPS[index].key }, { replace: true })

  if (campaignQuery.isLoading || launchQuery.isLoading) {
    return <Skeleton active className="mt-3 rounded-2xl bg-white p-6" paragraph={{ rows: 10 }} />
  }
  const error = campaignQuery.error || launchQuery.error
  if (error) {
    return <Alert className="mt-3" type="error" showIcon title={getApiErrorMessage(error, 'Không thể tải chiến dịch.')} />
  }
  const campaign = campaignQuery.data
  const overview = launchQuery.data

  return (
    <section className="mx-auto max-w-4xl space-y-4 pb-8 pt-3">
      <Link to={workspacePath} className="inline-flex items-center gap-1 text-sm text-slate-600">
        <ArrowLeftOutlined aria-hidden /> Về chiến dịch
      </Link>
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Thiết lập chiến dịch</h1>
        <p className="text-sm text-slate-500">{campaign.name}</p>
      </header>
      {!CAMPAIGN_SETUP_STATUSES.includes(campaign.status) ? (
        <Alert
          type="info"
          showIcon
          title="Chiến dịch đã chạy, không còn ở bước thiết lập."
          action={<Button size="small" onClick={() => navigate(workspacePath)}>Mở chiến dịch</Button>}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <Steps
            size="small"
            current={stepIndex}
            onChange={goTo}
            items={STEPS.map((step) => ({ title: step.title }))}
            className="!mb-6"
          />
          {stepIndex === 0 && (
            <CampaignGoalForm campaign={campaign} submitLabel="Lưu và tiếp tục" onSaved={() => goTo(1)} />
          )}
          {stepIndex === 1 && (
            <CampaignJobSelection campaign={campaign} overview={overview} onSaved={() => goTo(2)} />
          )}
          {stepIndex === 2 && (
            <CampaignLaunchReview campaign={campaign} overview={overview} onLaunched={() => navigate(workspacePath)} />
          )}
        </div>
      )}
    </section>
  )
}
