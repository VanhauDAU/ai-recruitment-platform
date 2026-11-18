import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Skeleton } from 'antd'
import { useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import ChannelIcon from './ChannelIcon'
import { useCampaignChannels } from '../model/use-campaign-channels'
import AddChannelModal from './AddChannelModal'
import ChannelContentModal from './ChannelContentModal'
import ChannelDetail from './ChannelDetail'
import './channel-board.css'

// Kênh phân phối của chiến dịch: danh sách bên trái, chi tiết kênh đang chọn bên phải.
export default function CampaignChannelBoard({ campaign }) {
  const [adding, setAdding] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const channelsQuery = useCampaignChannels(campaign.public_id)
  const editable = !['completed', 'cancelled'].includes(campaign.status)
  const channels = channelsQuery.data || []
  const selected = channels.find((item) => item.public_id === selectedId) || channels[0]

  if (channelsQuery.isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (channelsQuery.isError) {
    return <Alert type="error" showIcon title={getApiErrorMessage(channelsQuery.error, 'Không thể tải kênh.')} />
  }

  return (
    <div className="ch-board">
      <div className="ch-board__bar">
        <p className="ch-section-note">
          Mỗi nơi đăng tuyển là một kênh có link riêng, nhờ đó biết kênh nào mang về hồ sơ.
        </p>
        {editable && (
          <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => setAdding(true)}>
            Thêm kênh
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="ch-empty">
          <ShareAltOutlined aria-hidden className="ch-empty__icon" />
          <p className="ch-empty__title">Chưa có kênh nào</p>
          <p>Thêm Fanpage, nhóm Facebook, LinkedIn, Zalo hay tờ rơi có mã QR. ProCV soạn sẵn nội dung cho từng kênh.</p>
          {editable && <Button onClick={() => setAdding(true)}>Thêm kênh đầu tiên</Button>}
        </div>
      ) : (
        <div className="ch-layout">
          <nav className="ch-list" aria-label="Danh sách kênh">
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
                  <span>{channel.unique_clicks} người bấm, {channel.applications} hồ sơ</span>
                </span>
                <span className={`ch-dot ${channel.posted_at ? 'is-on' : ''}`} aria-hidden />
                <span className="ch-sr">{channel.posted_at ? 'Đã đăng' : 'Chưa đăng'}</span>
              </button>
            ))}
          </nav>
          <ChannelDetail
            key={selected.public_id}
            campaign={campaign}
            channel={selected}
            editable={editable}
            onEditContent={setEditingContent}
          />
        </div>
      )}

      <AddChannelModal
        campaign={campaign}
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(channel) => setSelectedId(channel.public_id)}
      />
      <ChannelContentModal
        key={editingContent?.public_id}
        campaignId={campaign.public_id}
        channel={editingContent}
        onClose={() => setEditingContent(null)}
      />
    </div>
  )
}
