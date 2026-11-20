import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import ChannelIcon from './ChannelIcon'
import { useCampaignChannels } from '../model/use-campaign-channels'
import AddChannelModal from './AddChannelModal'
import ChannelDetail from './ChannelDetail'
import './channel-board.css'

// Kênh phân phối của chiến dịch: danh sách bên trái, chi tiết kênh đang chọn bên phải.
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
        <div className="ch-layout">
          <nav className="ch-list" aria-label={m.employer_campaign_board_list_aria()}>
            {channels.map((channel) => (
              <button
                key={channel.public_id}
                type="button"
                className={`ch-list__item ${channel.public_id === selected.public_id ? 'is-active' : ''}`}
                aria-current={channel.public_id === selected.public_id ? 'true' : undefined}
                onClick={() => setSelectedId(channel.public_id)}
              >
                <ChannelIcon kind={channel.kind} />
                <span className="ch-list__text">
                  <strong>{channel.label}</strong>
                  <span>{m.employer_campaign_board_item_stats({ clicks: channel.unique_clicks, applications: channel.applications })}</span>
                </span>
                <span className={`ch-dot ${channel.posted_at ? 'is-on' : ''}`} aria-hidden />
                <span className="ch-sr">{channel.posted_at ? m.employer_campaign_board_posted() : m.employer_campaign_board_not_posted()}</span>
              </button>
            ))}
          </nav>
          <ChannelDetail
            key={selected.public_id}
            campaign={campaign}
            channel={selected}
            editable={editable}
          />
        </div>
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
