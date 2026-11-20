import { CopyOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Input } from 'antd'
import { useState } from 'react'
import { campaignKeys, updateCampaignChannel } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { copyText, postText, summary } from '../lib/channel-kinds'
import ChannelFacebookPosts from './ChannelFacebookPosts'
import PostComposer from './PostComposer'

const TARGET_LABELS = {
  landing: () => m.employer_campaign_post_target_landing(),
  job: () => m.employer_campaign_post_target_job(),
  company: () => m.employer_campaign_post_target_company(),
}

// Bài đang dùng của kênh đăng tay: đọc lướt, sao chép, sửa và đánh dấu đã đăng.
function ManualPost({ campaign, channel, editable, text, onEdit }) {
  const queryClient = useQueryClient()
  const [postedUrl, setPostedUrl] = useState(channel.posted_url || '')
  const update = useMutation({
    mutationFn: (payload) => updateCampaignChannel(campaign.public_id, channel.public_id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_content_update_error())),
  })
  const jobs = channel.jobs.length
    ? m.employer_campaign_post_jobs_count({ count: channel.jobs.length })
    : m.employer_campaign_post_jobs_newest()

  return (
    <article className="ch-draft">
      <p className="ch-draft__text">{summary(text)}</p>
      <p className="ch-draft__meta">{jobs} · {TARGET_LABELS[channel.target]()}</p>
      <div className="ch-draft__actions">
        <Button size="small" icon={<CopyOutlined aria-hidden />} onClick={() => copyText(text, m.employer_campaign_content_copy_label(), message)}>
          {m.employer_campaign_content_copy()}
        </Button>
        {editable && <Button size="small" icon={<EditOutlined aria-hidden />} onClick={onEdit}>{m.employer_campaign_composer_edit()}</Button>}
        {editable && (
          <Checkbox checked={Boolean(channel.posted_at)} onChange={(event) => update.mutate({ posted: event.target.checked })}>
            {m.employer_campaign_content_posted()}
          </Checkbox>
        )}
      </div>
      {editable && channel.posted_at && (
        <Input
          size="small"
          value={postedUrl}
          placeholder={m.employer_campaign_content_posted_url_placeholder()}
          onChange={(event) => setPostedUrl(event.target.value)}
          onBlur={() => postedUrl !== (channel.posted_url || '') && update.mutate({ posted_url: postedUrl.trim() })}
        />
      )}
    </article>
  )
}

// Tab Bài đăng: một nút soạn bài và danh sách bài. Mọi bước soạn nằm trong ngăn
// PostComposer, nên tab chỉ hiện kết quả: bài trên Fanpage hoặc bài đang dùng.
export default function ChannelPostSection({ campaign, channel, editable }) {
  const [composing, setComposing] = useState(false)
  const facebookPage = channel.kind === 'facebook_page'
  const text = postText(channel.rendered_content)

  return (
    <div className="ch-posts">
      <div className="ch-posts__bar">
        <p className="ch-section-note">
          {facebookPage ? m.employer_campaign_posts_intro() : m.employer_campaign_post_manual_note({ kind: channel.kind_label })}
        </p>
        {editable && (
          <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => setComposing(true)}>
            {m.employer_campaign_composer_open()}
          </Button>
        )}
      </div>

      {facebookPage ? (
        <ChannelFacebookPosts campaign={campaign} channel={channel} editable={editable} />
      ) : text ? (
        <ManualPost campaign={campaign} channel={channel} editable={editable} text={text} onEdit={() => setComposing(true)} />
      ) : (
        <p className="ch-section-note">{m.employer_campaign_post_empty()}</p>
      )}

      {editable && <PostComposer campaign={campaign} channel={channel} open={composing} onClose={() => setComposing(false)} />}
    </div>
  )
}
