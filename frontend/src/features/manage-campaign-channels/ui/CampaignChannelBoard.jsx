import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { useCampaignChannels } from '../model/use-campaign-channels'
import AddChannelModal from './AddChannelModal'
import ChannelCard from './ChannelCard'
import ChannelContentModal from './ChannelContentModal'
import ChannelCostsModal from './ChannelCostsModal'
import './channel-board.css'

// Danh sách kênh phân phối của chiến dịch: mỗi kênh một link theo dõi riêng.
export default function CampaignChannelBoard({ campaign }) {
  const [adding, setAdding] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [costChannel, setCostChannel] = useState(null)
  const channelsQuery = useCampaignChannels(campaign.public_id)
  const editable = !['completed', 'cancelled'].includes(campaign.status)
  const channels = channelsQuery.data || []

  if (channelsQuery.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (channelsQuery.isError) {
    return <Alert type="error" showIcon title={getApiErrorMessage(channelsQuery.error, 'Không thể tải kênh.')} />
  }

  return (
    <div className="ch-board">
      {channels.length === 0 ? (
        <div className="ch-empty">
          <ShareAltOutlined aria-hidden className="ch-empty__icon" />
          <div>
            <p className="ch-empty__title">Chưa có kênh nào</p>
            <p>
              Thêm mỗi nơi bạn sẽ đăng tuyển (nhóm Facebook, LinkedIn, Zalo, tờ rơi...) thành một kênh.
              Mỗi kênh có link riêng nên biết được kênh nào mang lại hồ sơ.
            </p>
          </div>
        </div>
      ) : (
        <div className="ch-grid">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.public_id}
              campaignId={campaign.public_id}
              channel={channel}
              editable={editable}
              onEditContent={setEditingContent}
              onOpenCosts={setCostChannel}
            />
          ))}
        </div>
      )}
      {editable && (
        <Button icon={<PlusOutlined aria-hidden />} onClick={() => setAdding(true)} className="ch-add">
          Thêm kênh
        </Button>
      )}
      <AddChannelModal campaign={campaign} open={adding} onClose={() => setAdding(false)} />
      <ChannelContentModal
        key={editingContent?.public_id}
        campaignId={campaign.public_id}
        channel={editingContent}
        onClose={() => setEditingContent(null)}
      />
      <ChannelCostsModal campaignId={campaign.public_id} channel={costChannel} onClose={() => setCostChannel(null)} />
    </div>
  )
}
