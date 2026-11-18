import { FacebookFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Form, Input, Modal, Radio, Select, Skeleton, Tag } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  campaignKeys,
  cancelChannelPost,
  getChannelPosts,
  getSocialConnections,
  rescheduleChannelPost,
  scheduleChannelPost,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_INTEGRATIONS_URL } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

const STATUS_COLORS = {
  scheduled: 'blue',
  publishing: 'processing',
  published: 'green',
  postponed: 'orange',
  failed: 'red',
  delete_failed: 'red',
}
const OPEN = ['scheduled', 'postponed', 'failed']
const when = (value) => dayjs(value).format('HH:mm DD/MM/YYYY')

function ScheduleModal({ campaignId, channel, defaultMessage, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const timing = Form.useWatch('timing', form)
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections })
  const connections = (connectionsQuery.data || []).filter((item) => item.status === 'connected')
  const mutation = useMutation({
    mutationFn: (values) => scheduleChannelPost(campaignId, channel.public_id, {
      connection: values.connection,
      message: values.message,
      scheduled_for: values.timing === 'later' ? values.scheduled_for.toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaignId, channel.public_id) })
      message.success('Đã hẹn đăng. Hệ thống sẽ đăng đúng giờ khi chiến dịch đang chạy.')
      onClose()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể hẹn đăng bài.')),
  })

  return (
    <Modal
      open
      width={600}
      title="Đăng lên Fanpage"
      okText="Hẹn đăng"
      cancelText="Hủy"
      okButtonProps={{ disabled: !connections.length }}
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      {connectionsQuery.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : !connections.length ? (
        <Alert
          type="info"
          showIcon
          title="Chưa kết nối Fanpage nào."
          description={<Link to={EMPLOYER_INTEGRATIONS_URL}>Kết nối Fanpage trong Cài đặt tài khoản</Link>}
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            connection: connections[0]?.public_id,
            timing: 'now',
            scheduled_for: dayjs().add(1, 'hour').startOf('hour'),
            message: defaultMessage,
          }}
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item label="Fanpage" name="connection" rules={[{ required: true, message: 'Chọn Fanpage.' }]}>
            <Select
              options={connections.map((item) => ({
                value: item.public_id,
                label: item.simulated ? `${item.page_name} (giả lập)` : item.page_name,
              }))}
            />
          </Form.Item>
          <Form.Item label="Thời điểm" name="timing">
            <Radio.Group
              options={[
                { value: 'now', label: 'Đăng ngay' },
                { value: 'later', label: 'Hẹn giờ' },
              ]}
            />
          </Form.Item>
          {timing === 'later' && (
            <Form.Item name="scheduled_for" rules={[{ required: true, message: 'Chọn giờ đăng.' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm', minuteStep: 5 }}
                format="HH:mm DD/MM/YYYY"
                disabledDate={(day) => day.isBefore(dayjs(), 'day')}
                className="!w-full"
              />
            </Form.Item>
          )}
          <Form.Item label="Nội dung bài" name="message" rules={[{ required: true, whitespace: true, message: 'Nhập nội dung.' }]}>
            <Input.TextArea rows={7} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

// Bài đăng tự động lên Fanpage của một kênh "Fanpage Facebook".
export default function ChannelFacebookPosts({ campaignId, channel, editable, defaultMessage }) {
  const queryClient = useQueryClient()
  const [scheduling, setScheduling] = useState(false)
  const key = campaignKeys.channelPosts(campaignId, channel.public_id)
  const postsQuery = useQuery({ queryKey: key, queryFn: () => getChannelPosts(campaignId, channel.public_id) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const onError = (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật bài đăng.'))
  const cancel = useMutation({ mutationFn: (postId) => cancelChannelPost(campaignId, channel.public_id, postId), onSuccess: refresh, onError })
  const retry = useMutation({
    mutationFn: (postId) => rescheduleChannelPost(campaignId, channel.public_id, postId, dayjs().add(1, 'minute').toISOString()),
    onSuccess: refresh,
    onError,
  })
  const posts = (postsQuery.data || []).filter((post) => post.status !== 'cancelled')

  return (
    <section className="ch-fb">
      <div className="ch-fb__head">
        <span className="ch-fb__title"><FacebookFilled aria-hidden /> Đăng tự động lên Fanpage</span>
        {editable && (
          <Button size="small" onClick={() => setScheduling(true)} disabled={!defaultMessage}>
            Hẹn đăng
          </Button>
        )}
      </div>
      {!defaultMessage && editable && <p className="ch-fb__hint">Soạn nội dung trước rồi hẹn đăng.</p>}
      {posts.map((post) => (
        <div key={post.public_id} className="ch-fb__post">
          <Tag color={STATUS_COLORS[post.status]}>{post.status_label}</Tag>
          <span className="ch-fb__when">
            {post.published_at ? `Đăng lúc ${when(post.published_at)}` : `Hẹn ${when(post.scheduled_for)}`}
            {post.page_name ? ` trên ${post.page_name}` : ''}
          </span>
          {post.permalink && post.status === 'published' && (
            <a href={post.permalink} target="_blank" rel="noreferrer">Xem bài</a>
          )}
          {editable && ['postponed', 'failed'].includes(post.status) && (
            <Button size="small" type="link" onClick={() => retry.mutate(post.public_id)}>Đăng lại ngay</Button>
          )}
          {editable && OPEN.includes(post.status) && (
            <Button size="small" type="link" danger onClick={() => cancel.mutate(post.public_id)}>Hủy</Button>
          )}
        </div>
      ))}
      {scheduling && (
        <ScheduleModal
          campaignId={campaignId}
          channel={channel}
          defaultMessage={defaultMessage}
          onClose={() => setScheduling(false)}
        />
      )}
    </section>
  )
}
