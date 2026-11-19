import { CampaignChannelBoard, ChannelReport } from '@/features/employer/campaign/manage-campaign-channels'
import { m } from '@/shared/config/i18n'

// Tab "Kênh & nguồn": quản lý từng kênh phân phối, rồi so sánh hiệu quả các nguồn hồ sơ.
export default function CampaignChannelsPanel({ campaign }) {
  return (
    <div className="cw-channels">
      <section>
        <h2 className="cw-section-title">{m.employer_campaign_step_channels()}</h2>
        <CampaignChannelBoard campaign={campaign} />
      </section>
      <section>
        <h2 className="cw-section-title">{m.employer_campaign_channels_report_title()}</h2>
        <p className="cw-section-intro">
          {m.employer_campaign_channels_report_intro()}
        </p>
        <ChannelReport campaignId={campaign.public_id} />
      </section>
    </div>
  )
}
