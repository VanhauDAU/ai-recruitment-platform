import { CopyOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Input } from 'antd'
import { useState } from 'react'
import { campaignKeys, generateCampaignChannelContent, updateCampaignChannel } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { copyText, postText } from '../lib/channel-kinds'
import SocialPostPreview from './SocialPostPreview'

const FALLBACK_NOTES = {
  ai_disabled: 'AI đang tắt nên dùng mẫu có sẵn. Hãy đọc lại và sửa cho hợp.',
  ai_failed: 'AI chưa trả lời được nên dùng mẫu có sẵn. Bạn có thể sửa hoặc soạn lại.',
}

// Nội dung bài của kênh: xem trước, sao chép, soạn bằng AI và ghi nhận đã đăng tay.
export default function ChannelContentSection({ campaign, channel, editable, onEditContent }) {
  const queryClient = useQueryClient()
  const [postedUrl, setPostedUrl] = useState(channel.posted_url || '')
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
  }
  const generate = useMutation({
    mutationFn: () => generateCampaignChannelContent(campaign.public_id, channel.public_id),
    onSuccess: (data) => {
      refresh()
      message[data.fallback_reason ? 'info' : 'success'](
        FALLBACK_NOTES[data.fallback_reason] || 'AI đã soạn xong. Hãy đọc lại trước khi đăng.',
      )
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể soạn nội dung.')),
  })
  const update = useMutation({
    mutationFn: (payload) => updateCampaignChannel(campaign.public_id, channel.public_id, payload),
    onSuccess: refresh,
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật kênh.')),
  })
  const text = postText(channel.rendered_content)
  const manual = channel.kind !== 'facebook_page'

  return (
    <div className="ch-content">
      <SocialPostPreview
        name={channel.label}
        meta={channel.kind_label}
        text={text}
        link={channel.kind.startsWith('facebook') ? channel.link : ''}
        linkTitle={campaign.name}
      />
      <div className="ch-content__side">
        <div className="ch-actions">
          <Button type="primary" icon={<CopyOutlined aria-hidden />} disabled={!text} onClick={() => copyText(text, 'nội dung', message)}>
            Sao chép bài
          </Button>
          {editable && (
            <>
              <Button icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                {text ? 'Soạn lại bằng AI' : 'Soạn bằng AI'}
              </Button>
              <Button icon={<EditOutlined aria-hidden />} onClick={() => onEditContent(channel)}>Sửa tay</Button>
            </>
          )}
        </div>
        <p className="ch-section-note">
          {channel.content_source === 'ai'
            ? 'Nội dung do AI soạn từ thông tin công khai của tin tuyển dụng. Đọc lại trước khi đăng.'
            : 'AI soạn nội dung theo đặc điểm kênh, chỉ dùng thông tin công khai của tin tuyển dụng.'}
        </p>
        {manual && editable && (
          <div className="ch-manual">
            <Checkbox checked={Boolean(channel.posted_at)} onChange={(event) => update.mutate({ posted: event.target.checked })}>
              Tôi đã đăng bài lên kênh này
            </Checkbox>
            {channel.posted_at && (
              <Input
                value={postedUrl}
                placeholder="Dán link bài đã đăng để mở lại sau (không bắt buộc)"
                onChange={(event) => setPostedUrl(event.target.value)}
                onBlur={() => postedUrl !== (channel.posted_url || '') && update.mutate({ posted_url: postedUrl.trim() })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
