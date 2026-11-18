import {
  CheckCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  MoreOutlined,
  QrcodeOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, Dropdown, Input, Modal, QRCode } from 'antd'
import { useState } from 'react'
import {
  campaignKeys,
  deleteCampaignChannel,
  generateCampaignChannelContent,
  updateCampaignChannel,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const FALLBACK_NOTES = {
  ai_disabled: 'AI đang tắt nên dùng mẫu có sẵn. Bạn có thể sửa lại.',
  ai_failed: 'AI chưa trả lời được nên dùng mẫu có sẵn. Bạn có thể sửa lại hoặc thử lại.',
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`Đã sao chép ${label}.`)
  } catch {
    message.error('Trình duyệt chặn sao chép. Hãy chọn và sao chép thủ công.')
  }
}

function postText(content) {
  const tags = (content.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
  return [content.headline, content.body, content.call_to_action, tags].filter(Boolean).join('\n\n')
}

function Stat({ value, label }) {
  return (
    <span className="ch-stat">
      <strong>{value}</strong>
      {label}
    </span>
  )
}

export default function ChannelCard({ campaignId, channel, editable, onEditContent, onOpenCosts }) {
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const [qrOpen, setQrOpen] = useState(false)
  const [postedUrl, setPostedUrl] = useState(channel.posted_url || '')
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaignId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaignId) })
  }
  const onError = (fallback) => (error) => message.error(getApiErrorMessage(error, fallback))
  const generate = useMutation({
    mutationFn: () => generateCampaignChannelContent(campaignId, channel.public_id),
    onSuccess: (data) => {
      refresh()
      message[data.fallback_reason ? 'info' : 'success'](
        FALLBACK_NOTES[data.fallback_reason] || 'AI đã soạn xong nội dung. Hãy đọc lại trước khi đăng.',
      )
    },
    onError: onError('Không thể soạn nội dung.'),
  })
  const update = useMutation({
    mutationFn: (payload) => updateCampaignChannel(campaignId, channel.public_id, payload),
    onSuccess: refresh,
    onError: onError('Không thể cập nhật kênh.'),
  })
  const remove = useMutation({
    mutationFn: () => deleteCampaignChannel(campaignId, channel.public_id),
    onSuccess: refresh,
    onError: onError('Không thể xóa kênh.'),
  })
  const content = channel.rendered_content || {}
  const hasContent = Boolean(content.body || content.headline)

  function downloadQr() {
    const canvas = document.getElementById(`qr-${channel.public_id}`)?.querySelector('canvas')
    if (!canvas) return
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = `qr-${channel.label}.png`
    anchor.click()
  }

  return (
    <article className="ch-card">
      <header className="ch-card__head">
        <div className="ch-card__title">
          <span className="ch-kind">{channel.kind_label}</span>
          <h3>{channel.label}</h3>
          {channel.posted_at && <span className="ch-posted"><CheckCircleFilled aria-hidden /> Đã đăng</span>}
        </div>
        {editable && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'content', icon: <EditOutlined />, label: 'Sửa nội dung' },
                { key: 'costs', icon: <DollarOutlined />, label: 'Chi phí' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa kênh', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'content') onEditContent(channel)
                if (key === 'costs') onOpenCosts(channel)
                if (key === 'delete') {
                  modal.confirm({
                    title: `Xóa kênh "${channel.label}"?`,
                    content: 'Link theo dõi ngừng hoạt động. Hồ sơ đã nhận vẫn giữ nguồn là loại kênh này.',
                    okText: 'Xóa kênh',
                    okButtonProps: { danger: true },
                    cancelText: 'Hủy',
                    onOk: () => remove.mutateAsync(),
                  })
                }
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với kênh ${channel.label}`} />
          </Dropdown>
        )}
      </header>

      <div className="ch-link">
        <code>{channel.link}</code>
        <Button size="small" icon={<CopyOutlined aria-hidden />} onClick={() => copyText(channel.link, 'link')}>
          Sao chép link
        </Button>
        <Button size="small" icon={<QrcodeOutlined aria-hidden />} onClick={() => setQrOpen(true)}>QR</Button>
      </div>
      <p className="ch-target">
        Dẫn tới {channel.target === 'job' ? `tin "${channel.job_title}"` : 'trang tuyển dụng của chiến dịch'}
      </p>

      <div className="ch-stats">
        <Stat value={channel.unique_clicks} label="người bấm" />
        <Stat value={channel.applications} label="hồ sơ" />
        <Stat value={channel.hires} label="trúng tuyển" />
        <Stat value={`${Number(channel.cost || 0).toLocaleString('vi-VN')} đ`} label="đã chi" />
      </div>

      <section className="ch-content">
        {hasContent ? (
          <>
            <p className="ch-content__text">{postText(content)}</p>
            <div className="ch-content__actions">
              <Button size="small" icon={<CopyOutlined aria-hidden />} onClick={() => copyText(postText(content), 'nội dung')}>
                Sao chép nội dung
              </Button>
              {editable && (
                <Button size="small" icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                  Soạn lại bằng AI
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="ch-content__empty">
            <span>Chưa có nội dung đăng cho kênh này.</span>
            {editable && (
              <Button type="primary" size="small" icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                Soạn bằng AI
              </Button>
            )}
          </div>
        )}
      </section>

      {editable && (
        <footer className="ch-card__foot">
          <Checkbox
            checked={Boolean(channel.posted_at)}
            onChange={(event) => update.mutate({ posted: event.target.checked })}
          >
            Đã đăng lên kênh này
          </Checkbox>
          {channel.posted_at && (
            <Input
              size="small"
              value={postedUrl}
              placeholder="Link bài đã đăng (không bắt buộc)"
              onChange={(event) => setPostedUrl(event.target.value)}
              onBlur={() => postedUrl !== (channel.posted_url || '') && update.mutate({ posted_url: postedUrl.trim() })}
            />
          )}
        </footer>
      )}

      <Modal open={qrOpen} title={`Mã QR: ${channel.label}`} footer={null} onCancel={() => setQrOpen(false)}>
        <div id={`qr-${channel.public_id}`} className="ch-qr">
          <QRCode value={channel.link} size={220} />
          <p>In mã này lên tờ rơi hoặc poster. Mỗi lượt quét được tính cho kênh "{channel.label}".</p>
          <Button type="primary" onClick={downloadQr}>Tải ảnh PNG</Button>
        </div>
      </Modal>
    </article>
  )
}
