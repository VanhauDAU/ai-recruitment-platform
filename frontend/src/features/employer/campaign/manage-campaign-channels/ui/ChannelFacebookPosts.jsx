import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  FacebookFilled,
  PauseCircleFilled,
  SendOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useState } from 'react'
import { campaignKeys, cancelChannelPost, getChannelPosts, rescheduleChannelPost } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { postText } from '../lib/channel-kinds'
import FacebookPostComposer from './FacebookPostComposer'

const STATUS = {
  scheduled: { icon: ClockCircleOutlined, tone: 'blue' },
  publishing: { icon: SyncOutlined, tone: 'blue' },
  published: { icon: CheckCircleFilled, tone: 'green' },
  postponed: { icon: PauseCircleFilled, tone: 'amber' },
  failed: { icon: CloseCircleFilled, tone: 'red' },
  delete_failed: { icon: CloseCircleFilled, tone: 'red' },
  deleted: { icon: CheckCircleFilled, tone: 'slate' },
}
const OPEN = ['scheduled', 'postponed', 'failed']
const when = (value) => dayjs(value).format('HH:mm DD/MM/YYYY')

function postTime(post) {
  if (post.status === 'published') return m.employer_campaign_posts_published_at({ time: when(post.published_at) })
  if (post.status === 'deleted') return m.employer_campaign_posts_deleted_at({ time: when(post.deleted_at) })
  return m.employer_campaign_posts_scheduled_for({ time: when(post.scheduled_for) })
}

// Bài đăng tự động lên Fanpage của kênh: dòng thời gian mới nhất trước, lỗi kèm cách xử lý.
export default function ChannelFacebookPosts({ campaign, channel, editable }) {
  const queryClient = useQueryClient()
  const [composing, setComposing] = useState(false)
  const key = campaignKeys.channelPosts(campaign.public_id, channel.public_id)
  const postsQuery = useQuery({
    queryKey: key,
    queryFn: () => getChannelPosts(campaign.public_id, channel.public_id),
    refetchInterval: (query) => ((query.state.data || []).some((post) => ['publishing', 'scheduled'].includes(post.status)) ? 15_000 : false),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const onError = (error) => message.error(getApiErrorMessage(error, m.employer_campaign_posts_update_error()))
  const cancel = useMutation({ mutationFn: (postId) => cancelChannelPost(campaign.public_id, channel.public_id, postId), onSuccess: refresh, onError })
  const retry = useMutation({
    mutationFn: (postId) => rescheduleChannelPost(campaign.public_id, channel.public_id, postId, dayjs().add(1, 'minute').toISOString()),
    onSuccess: () => {
      message.success(m.employer_campaign_posts_retried())
      refresh()
    },
    onError,
  })
  const posts = (postsQuery.data || []).filter((post) => post.status !== 'cancelled')
  const text = postText(channel.rendered_content)

  return (
    <div className="ch-fb">
      <div className="ch-fb__intro">
        <FacebookFilled aria-hidden className="ch-fb__logo" />
        <p className="ch-section-note">
          {m.employer_campaign_posts_intro()}
        </p>
        {editable && (
          <Button type="primary" icon={<SendOutlined aria-hidden />} onClick={() => setComposing(true)}>
            {m.employer_campaign_posts_create()}
          </Button>
        )}
      </div>

      {postsQuery.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : posts.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_campaign_posts_empty()} />
      ) : (
        <ol className="ch-timeline" aria-label={m.employer_campaign_posts_timeline_aria()}>
          {posts.map((post) => {
            const meta = STATUS[post.status] || STATUS.scheduled
            const Icon = meta.icon
            return (
              <li key={post.public_id} className={`ch-timeline__item is-${meta.tone}`}>
                <Icon aria-hidden className="ch-timeline__dot" spin={post.status === 'publishing'} />
                <div className="ch-timeline__body">
                  <div className="ch-timeline__top">
                    <strong>{post.status_label}</strong>
                    <span>{postTime(post)}{post.page_name ? m.employer_campaign_posts_on_page({ page: post.page_name }) : ''}</span>
                  </div>
                  <p className="ch-timeline__text">{post.message}</p>
                  {post.images?.length > 0 && (
                    <div className="ch-timeline__images">
                      {post.images.map((url, index) => <img key={url} src={url} alt={m.employer_campaign_posts_image_alt({ index: index + 1 })} />)}
                    </div>
                  )}
                  {post.error_message && <p className="ch-timeline__error">{post.error_message}</p>}
                  <div className="ch-timeline__actions">
                    {post.permalink && post.status === 'published' && (
                      <a href={post.permalink} target="_blank" rel="noreferrer">{m.employer_campaign_posts_open_on_facebook()}</a>
                    )}
                    {editable && ['postponed', 'failed'].includes(post.status) && (
                      <Button size="small" loading={retry.isPending && retry.variables === post.public_id} onClick={() => retry.mutate(post.public_id)}>
                        {m.employer_campaign_posts_repost()}
                      </Button>
                    )}
                    {editable && OPEN.includes(post.status) && (
                      <Button size="small" type="text" danger onClick={() => cancel.mutate(post.public_id)}>{m.employer_campaign_posts_cancel()}</Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <FacebookPostComposer
        campaign={campaign}
        channel={channel}
        defaultMessage={text}
        open={composing}
        onClose={() => setComposing(false)}
      />
    </div>
  )
}
