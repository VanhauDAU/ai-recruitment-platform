import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useState } from 'react'
import { ChannelIcon } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import FolderTabs from '@/shared/ui/folder-tabs/FolderTabs'
import { m } from '@/shared/config/i18n'
import { useCampaignChannels } from '../model/use-campaign-channels'
import AddChannelModal from './AddChannelModal'
import ChannelDetail from './ChannelDetail'
import './channel-board.css'

// Kênh phân phối của chiến dịch: hàng tab kênh ở trên, chi tiết kênh đang chọn bên dưới.
export default function CampaignChannelBoard({ campaign }) {
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const channelsQuery = useCampaignChannels(campaign.public_id)
  const editable = !['completed', 'cancelled'].includes(campaign.status)
  const channels = channelsQuery.data || []
  const selected = channels.find((item) => item.public_id === selectedId) || channels[0]

  if (channelsQuery.isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (channelsQuery.isError) {
    return <Alert type="error" showIcon title={getApiErrorMessage(channelsQuery.error, m.employer_campaign_board_load_error())} />
  }

  return (
    <div className="ch-board">
      <div className="ch-board__bar">
        <p className="ch-section-note">
          {m.employer_campaign_board_note()}
        </p>
        {editable && (
          <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => setAdding(true)}>
            {m.employer_campaign_health_action_add_channel()}
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="ch-empty">
          <ShareAltOutlined aria-hidden className="ch-empty__icon" />
          <p className="ch-empty__title">{m.employer_campaign_board_empty_title()}</p>
          <p>{m.employer_campaign_board_empty()}</p>
          {editable && <Button onClick={() => setAdding(true)}>{m.employer_campaign_board_add_first()}</Button>}
        </div>
      ) : (
        <FolderTabs
          idPrefix="channel"
          ariaLabel={m.employer_campaign_board_list_aria()}
          activeKey={selected.public_id}
          onChange={setSelectedId}
          plain
          destroyInactive
          items={channels.map((channel) => ({
            key: channel.public_id,
            title: channel.label,
            icon: <ChannelIcon kind={channel.kind} size="sm" />,
            label: channel.label,
            children: <ChannelDetail campaign={campaign} channel={channel} editable={editable} />,
          }))}
        />
      )}

      <AddChannelModal
        campaign={campaign}
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(channel) => setSelectedId(channel.public_id)}
      />
    </div>
  )
}
