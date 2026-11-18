import { useQuery } from '@tanstack/react-query'
import { Alert, Empty, Result, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { Link, useParams } from 'react-router'
import { useLoginPrompt } from '@/features/common/account/auth'
import { campaignKeys, getPublicCampaign } from '@/entities/campaign/campaign'
import { getJobs } from '@/entities/job/job'
import { useSession } from '@/entities/account/session'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import JobCard from './ui/JobCard'
import JobCardSkeleton from './ui/JobCardSkeleton'
import './campaign-landing.css'

const STATE_NOTES = {
  paused: 'Đợt tuyển này đang tạm dừng nhận hồ sơ. Bạn có thể xem các việc làm khác của công ty bên dưới.',
  upcoming: 'Đợt tuyển này sắp bắt đầu. Quay lại sau, hoặc xem các việc làm khác của công ty.',
  ended: 'Đợt tuyển này đã kết thúc. Xem các việc làm khác của công ty bên dưới.',
}

function period(campaign) {
  if (campaign.is_continuous) return 'Tuyển liên tục'
  if (!campaign.target_date) return ''
  return `Nhận hồ sơ đến ${dayjs(campaign.target_date).format('DD/MM/YYYY')}`
}

export default function CampaignLanding() {
  const { slug } = useParams()
  const { isAuthenticated } = useSession()
  const { promptLogin } = useLoginPrompt()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.publicLanding(slug),
    queryFn: () => getPublicCampaign(slug),
    retry: false,
  })
  const campaign = campaignQuery.data
  const isOpen = campaign?.state === 'open'
  const jobParams = isOpen ? { campaign: campaign.public_id } : { company: campaign?.company.public_id }
  const jobsQuery = useQuery({
    queryKey: ['jobs', 'list', jobParams],
    queryFn: () => getJobs(jobParams),
    enabled: Boolean(campaign),
  })
  useDocumentMetadata({
    title: campaign ? `${campaign.name} | ${campaign.company.name}` : 'Trang tuyển dụng',
    description: campaign?.intro || (campaign ? `${campaign.company.name} đang tuyển dụng: ${campaign.name}.` : ''),
    canonicalPath: `/tuyen-dung/${slug}`,
  })

  if (campaignQuery.isLoading) return <Skeleton active className="cpg-page cpg-page--loading" paragraph={{ rows: 8 }} />
  if (campaignQuery.isError) {
    return (
      <Result
        status="404"
        title="Không tìm thấy trang tuyển dụng"
        subTitle="Đường dẫn không đúng hoặc nhà tuyển dụng đã tắt trang này."
        extra={<Link to="/viec-lam">Tìm việc làm khác</Link>}
      />
    )
  }
  const jobs = jobsQuery.data?.results || []
  const company = campaign.company

  return (
    <div className="cpg-page">
      <header className="cpg-hero">
        {company.cover_image_url && <img className="cpg-hero__cover" src={company.cover_image_url} alt="" />}
        <div className="cpg-hero__body">
          {company.logo_url && <img className="cpg-hero__logo" src={company.logo_url} alt={`Logo ${company.name}`} />}
          <div className="cpg-hero__text">
            <Link to={`/cong-ty/${company.slug}`} className="cpg-hero__company">{company.name}</Link>
            <h1 className="cpg-hero__title">{campaign.name}</h1>
            {period(campaign) && <p className="cpg-hero__period">{period(campaign)}</p>}
          </div>
        </div>
        {campaign.intro && <p className="cpg-hero__intro">{campaign.intro}</p>}
      </header>

      {!isOpen && <Alert type={campaign.state === 'ended' ? 'info' : 'warning'} showIcon title={STATE_NOTES[campaign.state]} />}

      <section className="cpg-jobs" aria-labelledby="cpg-jobs-title">
        <h2 id="cpg-jobs-title" className="cpg-jobs__title">
          {isOpen ? `Vị trí đang tuyển (${jobsQuery.data?.count ?? 0})` : `Việc làm khác của ${company.name}`}
        </h2>
        {jobsQuery.isLoading
          ? Array.from({ length: 3 }, (_, index) => <JobCardSkeleton key={index} />)
          : jobs.length === 0
            ? <Empty description="Hiện chưa có vị trí nào đang nhận hồ sơ." />
            : jobs.map((job) => (
                <JobCard
                  key={job.public_id}
                  job={job}
                  isAuthenticated={isAuthenticated}
                  onRequireLogin={promptLogin}
                  showQuickView={false}
                />
              ))}
      </section>
    </div>
  )
}
