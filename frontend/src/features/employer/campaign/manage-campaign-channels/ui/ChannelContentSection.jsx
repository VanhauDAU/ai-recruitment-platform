import { CopyOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Input } from 'antd'
import { useState } from 'react'
import { campaignKeys, generateCampaignChannelContent, updateCampaignChannel } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { copyText, postText } from '../lib/channel-kinds'
import SocialPostPreview from './SocialPostPreview'

const FALLBACK_NOTES = {
  ai_disabled: m.employer_campaign_content_ai_disabled(),
  ai_failed: m.employer_campaign_content_ai_failed(),
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
        FALLBACK_NOTES[data.fallback_reason] || m.employer_campaign_content_ai_done(),
      )
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_content_generate_error())),
  })
  const update = useMutation({
    mutationFn: (payload) => updateCampaignChannel(campaign.public_id, channel.public_id, payload),
    onSuccess: refresh,
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_content_update_error())),
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
          <Button type="primary" icon={<CopyOutlined aria-hidden />} disabled={!text} onClick={() => copyText(text, m.employer_campaign_content_copy_label(), message)}>
            {m.employer_campaign_content_copy()}
          </Button>
          {editable && (
            <>
              <Button icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                {text ? m.employer_campaign_content_regenerate() : m.employer_campaign_content_generate()}
              </Button>
              <Button icon={<EditOutlined aria-hidden />} onClick={() => onEditContent(channel)}>{m.employer_campaign_content_edit_manually()}</Button>
            </>
          )}
        </div>
        <p className="ch-section-note">
          {channel.content_source === 'ai'
            ? m.employer_campaign_content_source_ai()
            : m.employer_campaign_content_source_hint()}
        </p>
        {manual && editable && (
          <div className="ch-manual">
            <Checkbox checked={Boolean(channel.posted_at)} onChange={(event) => update.mutate({ posted: event.target.checked })}>
              {m.employer_campaign_content_posted()}
            </Checkbox>
            {channel.posted_at && (
              <Input
                value={postedUrl}
                placeholder={m.employer_campaign_content_posted_url_placeholder()}
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
