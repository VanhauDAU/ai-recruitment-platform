import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  PauseCircleFilled,
  SyncOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { campaignKeys, cancelChannelPost, getChannelPosts, rescheduleChannelPost } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { summary } from '../lib/channel-kinds'

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
// Bài còn trên mạng: đã đăng, hoặc chờ NTD tự gỡ khi mạng không gỡ được.
const OPEN_LINK = ['published', 'delete_failed']
const when = (value) => dayjs(value).format('HH:mm DD/MM/YYYY')
// Bài đã tới giờ, đang chờ worker (``queued``) hiển thị như đang đăng.
const shownStatus = (post) => (post.queued ? 'publishing' : post.status)
// Đang đăng thì làm mới nhanh để thấy kết quả; còn bài hẹn giờ thì thưa hơn.
function refreshEvery(posts = []) {
  if (posts.some((post) => shownStatus(post) === 'publishing')) return 3_000
  return posts.some((post) => post.status === 'scheduled') ? 15_000 : false
}

function postTime(post) {
  if (post.status === 'published') return m.employer_campaign_posts_published_at({ time: when(post.published_at) })
  if (post.status === 'deleted') return m.employer_campaign_posts_deleted_at({ time: when(post.deleted_at) })
  return m.employer_campaign_posts_scheduled_for({ time: when(post.scheduled_for) })
}

// Bài tự đăng của kênh: mới nhất trước, lỗi kèm cách xử lý, đăng lại hoặc hủy.
export default function ChannelSocialPosts({ campaign, channel, network, editable }) {
  const queryClient = useQueryClient()
  const key = campaignKeys.channelPosts(campaign.public_id, channel.public_id)
  const postsQuery = useQuery({
    queryKey: key,
    queryFn: () => getChannelPosts(campaign.public_id, channel.public_id),
    refetchInterval: (query) => refreshEvery(query.state.data),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const onError = (error) => message.error(getApiErrorMessage(error, m.employer_campaign_posts_update_error()))
  const cancel = useMutation({ mutationFn: (postId) => cancelChannelPost(campaign.public_id, channel.public_id, postId), onSuccess: refresh, onError })
  const retry = useMutation({
    mutationFn: (postId) => rescheduleChannelPost(campaign.public_id, channel.public_id, postId, dayjs().toISOString()),
    onSuccess: () => {
      message.success(m.employer_campaign_posts_retried())
      refresh()
    },
    onError,
  })
  const posts = (postsQuery.data || []).filter((post) => post.status !== 'cancelled')

  return (
    <div className="ch-fb">
      {postsQuery.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : posts.length === 0 ? (
        <p className="ch-section-note">{m.employer_campaign_posts_empty({ network: network.label })}</p>
      ) : (
        <ol className="ch-postcards" aria-label={m.employer_campaign_posts_timeline_aria({ network: network.label })}>
          {posts.map((post) => {
            const status = shownStatus(post)
            const meta = STATUS[status] || STATUS.scheduled
            const Icon = meta.icon
            const [cover, ...more] = post.images || []
            return (
              <li key={post.public_id} className="ch-postcard">
                <div className="ch-postcard__head">
                  <span className={`ch-status is-${meta.tone}`}>
                    <Icon aria-hidden spin={status === 'publishing'} />
                    {post.status_label}
                  </span>
                  <span className="ch-postcard__when">{postTime(post)}</span>
                  {post.account_name && <span className="ch-postcard__page">{post.account_name}</span>}
                </div>
                <div className="ch-postcard__body">
                  {cover && (
                    <span className="ch-postcard__thumb">
                      <img src={cover} alt={m.employer_campaign_posts_image_alt({ index: 1 })} />
                      {more.length > 0 && <span aria-hidden>+{more.length}</span>}
                    </span>
                  )}
                  <p className="ch-postcard__text">{summary(post.message)}</p>
                </div>
                {post.error_message && <p className="ch-postcard__error">{post.error_message}</p>}
                {(post.permalink && OPEN_LINK.includes(post.status)) || (editable && OPEN.includes(post.status)) ? (
                  <div className="ch-postcard__actions">
                    {post.permalink && OPEN_LINK.includes(post.status) && (
                      <a href={post.permalink} target="_blank" rel="noreferrer">{m.employer_campaign_posts_open_on_facebook({ network: network.platform })}</a>
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
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
