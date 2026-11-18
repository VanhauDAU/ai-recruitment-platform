import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Drawer, Form, Input, Segmented, Select, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { campaignKeys, getSocialConnections, scheduleChannelPost } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_INTEGRATIONS_URL } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import SocialPostPreview from './SocialPostPreview'

const REPEATS = [3, 7, 14]
const when = (value) => dayjs(value).format('HH:mm, DD/MM')

// Khung giờ người tìm việc hay lướt mạng xã hội: tối, sáng sớm và giờ nghỉ trưa.
function presets(now = dayjs()) {
  const tonight = now.hour(20).minute(0).second(0)
  const tomorrow = now.add(1, 'day')
  return [
    { label: 'Tối nay 20:00', value: tonight.isAfter(now.add(10, 'minute')) ? tonight : tonight.add(1, 'day') },
    { label: 'Sáng mai 8:00', value: tomorrow.hour(8).minute(0).second(0) },
    { label: 'Trưa mai 12:00', value: tomorrow.hour(12).minute(0).second(0) },
  ]
}

function plannedTimes({ timing, scheduled_for: at, repeats = [] }) {
  const first = timing === 'now' ? null : at
  if (timing !== 'series') return [first]
  return [first, ...repeats.map((days) => (first || dayjs()).add(days, 'day'))]
}

export default function FacebookPostComposer({ campaign, channel, defaultMessage, open, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const values = Form.useWatch([], form) || {}
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections, enabled: open })
  const connections = (connectionsQuery.data || []).filter((item) => item.status === 'connected')
  const page = connections.find((item) => item.public_id === values.connection) || connections[0]
  const times = plannedTimes(values)
  const mutation = useMutation({
    mutationFn: async (data) => {
      for (const at of plannedTimes(data)) {
        await scheduleChannelPost(campaign.public_id, channel.public_id, {
          connection: data.connection,
          message: data.message,
          scheduled_for: at ? at.toISOString() : null,
        })
      }
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      const count = plannedTimes(data).length
      message.success(data.timing === 'now' ? 'Đã gửi bài, Fanpage sẽ có bài trong khoảng 1 phút.' : `Đã hẹn ${count} bài đăng.`)
      onClose()
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      message.error(getApiErrorMessage(error, 'Không thể hẹn đăng bài.'))
    },
  })
  const submitLabel = values.timing === 'now' ? 'Đăng ngay' : values.timing === 'series' ? `Hẹn ${times.length} bài` : 'Hẹn đăng'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="min(980px, 100vw)"
      title="Đăng lên Fanpage"
      className="ch-composer"
      extra={(
        <Button type="primary" loading={mutation.isPending} disabled={!connections.length} onClick={() => form.submit()}>
          {submitLabel}
        </Button>
      )}
    >
      {connectionsQuery.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : !connections.length ? (
        <Alert
          type="info"
          showIcon
          title="Chưa kết nối Fanpage nào"
          description={<>Kết nối Fanpage một lần trong <Link to={EMPLOYER_INTEGRATIONS_URL}>Cài đặt tài khoản</Link>, sau đó quay lại đây để đăng.</>}
        />
      ) : (
        <div className="ch-composer__grid">
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              connection: connections[0]?.public_id,
              timing: 'now',
              scheduled_for: presets()[0].value,
              repeats: [7],
              message: defaultMessage,
            }}
            onFinish={(data) => mutation.mutate(data)}
          >
            <Form.Item label="Fanpage" name="connection" rules={[{ required: true, message: 'Chọn Fanpage.' }]}>
              <Select
                options={connections.map((item) => ({
                  value: item.public_id,
                  label: item.simulated ? `${item.page_name} (giả lập)` : item.page_name,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="Nội dung"
              name="message"
              extra="Link theo dõi của kênh được gắn vào bài khi đăng."
              rules={[{ required: true, whitespace: true, message: 'Nhập nội dung bài.' }]}
            >
              <Input.TextArea autoSize={{ minRows: 8, maxRows: 16 }} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item label="Thời điểm đăng" name="timing">
              <Segmented
                block
                options={[
                  { value: 'now', label: 'Đăng ngay' },
                  { value: 'later', label: 'Hẹn giờ' },
                  { value: 'series', label: 'Đăng nhiều lần' },
                ]}
              />
            </Form.Item>
            {values.timing !== 'now' && (
              <>
                <div className="ch-chips" role="group" aria-label="Chọn nhanh giờ đăng">
                  {presets().map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`ch-chip ${values.scheduled_for?.isSame?.(item.value, 'minute') ? 'is-on' : ''}`}
                      onClick={() => form.setFieldValue('scheduled_for', item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <Form.Item label={values.timing === 'series' ? 'Lần đầu' : 'Giờ đăng'} name="scheduled_for" rules={[{ required: true, message: 'Chọn giờ đăng.' }]}>
                  <DatePicker
                    showTime={{ format: 'HH:mm', minuteStep: 5 }}
                    format="HH:mm DD/MM/YYYY"
                    allowClear={false}
                    disabledDate={(day) => day.isBefore(dayjs(), 'day')}
                    className="!w-full"
                  />
                </Form.Item>
              </>
            )}
            {values.timing === 'series' && (
              <Form.Item
                label="Đăng nhắc lại sau"
                name="repeats"
                extra="Nhắc lại giúp bài lên lại bảng tin của người theo dõi chưa kịp thấy lần đầu."
                rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một lần nhắc lại.' }]}
              >
                <Checkbox.Group options={REPEATS.map((days) => ({ value: days, label: `${days} ngày` }))} />
              </Form.Item>
            )}
            {values.timing === 'series' && (
              <ol className="ch-plan" aria-label="Lịch đăng">
                {times.map((at, index) => <li key={index}>{at ? when(at) : 'Ngay bây giờ'}</li>)}
              </ol>
            )}
          </Form>
          <aside className="ch-composer__preview">
            <p className="ch-section-note">Xem trước trên Facebook</p>
            <SocialPostPreview
              name={page?.page_name || 'Fanpage'}
              avatarUrl={page?.page_picture_url}
              meta={values.timing === 'now' || !values.scheduled_for ? 'Vừa xong' : when(values.scheduled_for)}
              text={values.message || ''}
              link={channel.link}
              linkTitle={campaign.name}
            />
            {campaign.status !== 'active' && (
              <Alert type="warning" showIcon title="Chiến dịch chưa chạy" description="Bài chỉ được đăng khi chiến dịch đang chạy; tới lúc đó bài đến hạn sẽ đăng ngay." />
            )}
          </aside>
        </div>
      )}
    </Drawer>
  )
}
