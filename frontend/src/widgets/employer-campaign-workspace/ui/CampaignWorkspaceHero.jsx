import { EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { CAMPAIGN_SETUP_STATUSES, CAMPAIGN_STATUS_LABELS } from '@/entities/campaign'
import { CampaignLifecycleActions } from '@/features/manage-campaigns'
import { employerAppPath } from '@/shared/config/portals'
import './campaign-workspace.css'

const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '')
const money = (value) => `${Number(value).toLocaleString('vi-VN')} đ`

function campaignFacts(campaign) {
  const end = campaign.is_continuous ? 'tuyển liên tục' : formatDate(campaign.target_date) || 'chưa đặt'
  const budget = campaign.budget_max
    ? `${campaign.budget_min ? `${money(campaign.budget_min)} đến ` : 'tối đa '}${money(campaign.budget_max)}`
    : 'Chưa đặt'
  return [
    ['Chỉ tiêu', campaign.headcount ? `${campaign.headcount} người qua ${campaign.job_count} tin` : 'Chưa có tin'],
    ['Thời gian', `${formatDate(campaign.start_date) || 'Khi kích hoạt'} đến ${end}`],
    ['Ngân sách', budget],
    ['Đã chạy', campaign.active_days == null ? 'Chưa kích hoạt' : `${campaign.active_days.toLocaleString('vi-VN')} ngày`],
  ]
}

// Việc chính theo trạng thái; thao tác vòng đời nằm trong menu của CampaignLifecycleActions.
function PrimaryAction({ campaign }) {
  if (CAMPAIGN_SETUP_STATUSES.includes(campaign.status)) {
    return (
      <Link to={employerAppPath(`/campaigns/${campaign.public_id}/setup`)}>
        <Button type="primary" icon={<SettingOutlined aria-hidden />}>
          {campaign.status === 'scheduled' ? 'Xem lịch kích hoạt' : 'Tiếp tục thiết lập'}
        </Button>
      </Link>
    )
  }
  if (campaign.status === 'active') {
    return (
      <Link to={`${employerAppPath('/jobs/new')}?campaign=${campaign.public_id}`}>
        <Button type="primary" icon={<PlusOutlined aria-hidden />}>Đăng thêm tin</Button>
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
          </div>
          <h1 className="cw-hero__title">{campaign.name}</h1>
        </div>
        <div className="cw-hero__actions">
          <PrimaryAction campaign={campaign} />
          {!ended && <Button icon={<EditOutlined aria-hidden />} onClick={onEdit}>Sửa thông tin</Button>}
          <CampaignLifecycleActions campaign={campaign} />
        </div>
      </div>
      <dl className="cw-facts">
        {campaignFacts(campaign).map(([label, value]) => (
          <div key={label} className="cw-fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}
