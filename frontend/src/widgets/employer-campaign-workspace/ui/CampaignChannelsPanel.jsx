import { CampaignChannelBoard, ChannelReport } from '@/features/manage-campaign-channels'

// Tab "Kênh & nguồn": so sánh hiệu quả rồi quản lý từng kênh phân phối.
export default function CampaignChannelsPanel({ campaign }) {
  return (
    <div className="cw-channels">
      <section>
        <h2 className="cw-section-title">Hiệu quả theo nguồn</h2>
        <p className="cw-section-intro">
          Hồ sơ được tính cho kênh khi ứng viên vào qua link của kênh đó trong 30 ngày trước khi nộp.
          Ứng viên chưa đồng ý cookie phân tích chỉ được tính nếu nộp ngay trong lần truy cập đó.
        </p>
        <ChannelReport campaignId={campaign.public_id} />
      </section>
      <section>
        <h2 className="cw-section-title">Kênh phân phối</h2>
        <CampaignChannelBoard campaign={campaign} />
      </section>
    </div>
  )
}
