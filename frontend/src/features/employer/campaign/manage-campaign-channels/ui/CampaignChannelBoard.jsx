import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useState } from 'react'
import { ChannelIcon } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { useCampaignChannels } from '../model/use-campaign-channels'
import AddChannelModal from './AddChannelModal'
import ChannelDetail from './ChannelDetail'
import './channel-board.css'

// Mũi tên trái/phải, Home/End chuyển giữa các tab kênh (mẫu tablist của WAI-ARIA).
function moveFocus(event) {
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
  const index = tabs.indexOf(document.activeElement)
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key]
  if (index < 0 || next === undefined) return
  event.preventDefault()
  const target = tabs[(next + tabs.length) % tabs.length]
  target.focus()
  target.click()
}

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
        <div className="ch-shell">
          <div className="ch-strip" role="tablist" aria-label={m.employer_campaign_board_list_aria()} onKeyDown={moveFocus}>
            {channels.map((channel) => {
              const active = channel.public_id === selected.public_id
              return (
                <button
                  key={channel.public_id}
                  id={`channel-tab-${channel.public_id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`channel-panel-${channel.public_id}`}
                  tabIndex={active ? 0 : -1}
                  title={channel.label}
                  className={`ch-tab ${active ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(channel.public_id)}
                >
                  <ChannelIcon kind={channel.kind} size="sm" />
                  <span className="ch-tab__label">{channel.label}</span>
                </button>
              )
            })}
          </div>
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
