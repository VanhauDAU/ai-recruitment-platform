import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Drawer, Form, Input, Segmented, Select, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { Link } from 'react-router'
import { campaignKeys, getSocialConnections, scheduleChannelPost } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_INTEGRATIONS_URL } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import PostImagePicker from './PostImagePicker'
import SocialPostPreview from './SocialPostPreview'

const REPEATS = [3, 7, 14]
const when = (value) => dayjs(value).format('HH:mm, DD/MM')

// Khung giờ người tìm việc hay lướt mạng xã hội: tối, sáng sớm và giờ nghỉ trưa.
function presets(now = dayjs()) {
  const tonight = now.hour(20).minute(0).second(0)
  const tomorrow = now.add(1, 'day')
  return [
    { label: m.employer_campaign_fb_preset_tonight(), value: tonight.isAfter(now.add(10, 'minute')) ? tonight : tonight.add(1, 'day') },
    { label: m.employer_campaign_fb_preset_tomorrow_morning(), value: tomorrow.hour(8).minute(0).second(0) },
    { label: m.employer_campaign_fb_preset_tomorrow_noon(), value: tomorrow.hour(12).minute(0).second(0) },
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
          images: (data.images || []).map((image) => image.path),
          scheduled_for: at ? at.toISOString() : null,
        })
      }
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      const count = plannedTimes(data).length
      message.success(data.timing === 'now' ? m.employer_campaign_fb_sent() : m.employer_campaign_fb_scheduled({ count }))
      onClose()
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      message.error(getApiErrorMessage(error, m.employer_campaign_fb_schedule_error()))
    },
  })
  const submitLabel = values.timing === 'now'
    ? m.employer_campaign_fb_post_now()
    : values.timing === 'series' ? m.employer_campaign_fb_schedule_count({ count: times.length }) : m.employer_campaign_fb_schedule()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="min(980px, 100vw)"
      title={m.employer_campaign_fb_title()}
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
          title={m.employer_campaign_fb_no_connection()}
          description={<>{m.employer_campaign_fb_connect_prefix()}<Link to={EMPLOYER_INTEGRATIONS_URL}>{m.employer_campaign_fb_account_settings()}</Link>{m.employer_campaign_fb_connect_suffix()}</>}
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
              images: [],
            }}
            onFinish={(data) => mutation.mutate(data)}
          >
            <Form.Item label="Fanpage" name="connection" rules={[{ required: true, message: m.employer_campaign_fb_pick_page() }]}>
              <Select
                options={connections.map((item) => ({
                  value: item.public_id,
                  label: item.simulated ? m.employer_campaign_fb_simulated({ name: item.page_name }) : item.page_name,
                }))}
              />
            </Form.Item>
            <Form.Item
              label={m.employer_campaign_fb_content()}
              name="message"
              extra={m.employer_campaign_fb_content_extra()}
              rules={[{ required: true, whitespace: true, message: m.employer_campaign_fb_content_required() }]}
            >
              <Input.TextArea autoSize={{ minRows: 8, maxRows: 16 }} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item label={m.employer_campaign_fb_images()} name="images">
              <PostImagePicker campaignId={campaign.public_id} channelId={channel.public_id} />
            </Form.Item>
            <Form.Item label={m.employer_campaign_fb_timing()} name="timing">
              <Segmented
                block
                options={[
                  { value: 'now', label: m.employer_campaign_fb_post_now() },
                  { value: 'later', label: m.employer_campaign_fb_timing_later() },
                  { value: 'series', label: m.employer_campaign_fb_timing_series() },
                ]}
              />
            </Form.Item>
            {values.timing !== 'now' && (
              <>
                <div className="ch-chips" role="group" aria-label={m.employer_campaign_fb_quick_times_aria()}>
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
                <Form.Item label={values.timing === 'series' ? m.employer_campaign_fb_first_time() : m.employer_campaign_fb_post_time()} name="scheduled_for" rules={[{ required: true, message: m.employer_campaign_fb_post_time_required() }]}>
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
                label={m.employer_campaign_fb_repeat_after()}
                name="repeats"
                extra={m.employer_campaign_fb_repeat_extra()}
                rules={[{ required: true, type: 'array', min: 1, message: m.employer_campaign_fb_repeat_required() }]}
              >
                <Checkbox.Group options={REPEATS.map((days) => ({ value: days, label: m.employer_campaign_fb_days({ count: days }) }))} />
              </Form.Item>
            )}
            {values.timing === 'series' && (
              <ol className="ch-plan" aria-label={m.employer_campaign_fb_plan_aria()}>
                {times.map((at, index) => <li key={index}>{at ? when(at) : m.employer_campaign_fb_right_now()}</li>)}
              </ol>
            )}
          </Form>
          <aside className="ch-composer__preview">
            <p className="ch-section-note">{m.employer_campaign_fb_preview()}</p>
            <SocialPostPreview
              name={page?.page_name || 'Fanpage'}
              avatarUrl={page?.page_picture_url}
              meta={values.timing === 'now' || !values.scheduled_for ? m.employer_campaign_fb_just_now() : when(values.scheduled_for)}
              text={values.message || ''}
              images={(values.images || []).map((image) => image.url)}
              link={channel.link}
              linkTitle={campaign.name}
            />
            {campaign.status !== 'active' && (
              <Alert type="warning" showIcon title={m.employer_campaign_fb_not_running()} description={m.employer_campaign_fb_not_running_description()} />
            )}
          </aside>
        </div>
      )}
    </Drawer>
  )
}
