import { CopyOutlined, LinkOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Drawer, Dropdown, Form, Input, Segmented, Select, Skeleton } from 'antd'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  campaignKeys,
  generateCampaignChannelContent,
  getSocialConnections,
  scheduleChannelPost,
  updateCampaignChannel,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { EMPLOYER_INTEGRATIONS_URL } from '@/shared/config/portals'
import dayjs from '@/shared/lib/dayjs'
import { message } from '@/shared/lib/toast'
import { copyText, postText } from '../lib/channel-kinds'
import PostImagePicker from './PostImagePicker'
import SocialPostPreview from './SocialPostPreview'

const REPEATS = [3, 7, 14]
const when = (value) => dayjs(value).format('HH:mm, DD/MM')
const FALLBACK_NOTES = {
  ai_disabled: () => m.employer_campaign_content_ai_disabled(),
  ai_failed: () => m.employer_campaign_content_ai_failed(),
}
const TARGETS = [
  { value: 'landing', label: () => m.employer_campaign_post_target_landing(), hint: () => m.employer_campaign_post_target_landing_hint() },
  { value: 'job', label: () => m.employer_campaign_post_target_job(), hint: () => m.employer_campaign_post_target_job_hint() },
  { value: 'company', label: () => m.employer_campaign_post_target_company(), hint: () => m.employer_campaign_post_target_company_hint() },
]
const sameJobs = (a = [], b = []) => a.length === b.length && a.every((id) => b.includes(id))
const linkLabel = (link) => (
  link.key === 'landing' ? m.employer_campaign_post_target_landing()
    : link.key === 'company' ? m.employer_campaign_post_target_company()
      : m.employer_campaign_link_job({ title: link.label })
)

// Tiêu đề tin trong chip ngắn: dài hơn chip thì trượt qua lại chậm để đọc hết.
function MarqueeText({ children }) {
  const ref = useRef(null)
  const [shift, setShift] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => setShift(Math.max(0, element.scrollWidth - element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children])
  return (
    <span ref={ref} className={`ch-marquee ${shift ? 'is-moving' : ''}`} style={shift ? { '--marquee-shift': `-${shift}px` } : undefined}>
      <span className="ch-marquee__text">{children}</span>
    </span>
  )
}

// Chọn tin trong bài bằng chip; để trống là tin mới nhất đang mở.
function JobChips({ options, value = [], onChange }) {
  if (!options.length) return <p className="ch-section-note">{m.employer_campaign_post_no_jobs()}</p>
  const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  return (
    <>
      <div className="ch-chips ch-jobchips" role="group" aria-label={m.employer_campaign_post_jobs()}>
        {options.map((job) => (
          <button key={job.value} type="button" title={job.label} className={`ch-chip ${value.includes(job.value) ? 'is-on' : ''}`} aria-pressed={value.includes(job.value)} onClick={() => toggle(job.value)}>
            <MarqueeText>{job.label}</MarqueeText>
          </button>
        ))}
      </div>
      {!value.length && <p className="ch-section-note">{m.employer_campaign_post_jobs_default()}</p>}
    </>
  )
}

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

// Phần riêng của kênh tự đăng: tài khoản, ảnh, đăng ngay / hẹn giờ / đăng nhiều lần.
function SocialAccountFields({ campaign, channel, network, values, form, times, connections }) {
  return (
    <>
      <Form.Item label={network.label} name="connection" rules={[{ required: true, message: m.employer_campaign_fb_pick_page({ network: network.label }) }]}>
        <Select
          options={connections.map((item) => ({
            value: item.public_id,
            label: item.simulated ? m.employer_campaign_fb_simulated({ name: item.account_name }) : item.account_name,
          }))}
        />
      </Form.Item>
      <Form.Item
        label={m.employer_campaign_fb_images()}
        name="images"
        rules={network.capabilities.requires_image ? [{ required: true, type: 'array', min: 1, message: m.employer_campaign_images_required({ network: network.platform }) }] : []}
      >
        <PostImagePicker campaignId={campaign.public_id} channelId={channel.public_id} max={network.capabilities.max_images} />
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
        <>
          <Form.Item
            label={m.employer_campaign_fb_repeat_after()}
            name="repeats"
            extra={m.employer_campaign_fb_repeat_extra()}
            rules={[{ required: true, type: 'array', min: 1, message: m.employer_campaign_fb_repeat_required() }]}
          >
            <Checkbox.Group options={REPEATS.map((days) => ({ value: days, label: m.employer_campaign_fb_days({ count: days }) }))} />
          </Form.Item>
          <ol className="ch-plan" aria-label={m.employer_campaign_fb_plan_aria()}>
            {times.map((at, index) => <li key={index}>{at ? when(at) : m.employer_campaign_fb_right_now()}</li>)}
          </ol>
        </>
      )}
    </>
  )
}

// Soạn một bài của kênh trong một ngăn: tin trong bài, link dẫn tới, nội dung (AI hoặc
// tự viết) và xem trước. Kênh có mạng tự đăng (``network``) đăng ngay/hẹn giờ; kênh khác
// lưu rồi sao chép để tự đăng.
export default function PostComposer({ campaign, channel, network, open, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const values = Form.useWatch([], form) || {}
  const caret = useRef(null)
  const autoPost = Boolean(network)
  const initialText = postText(channel.rendered_content)
  // Tin/link mà nội dung hiện tại được soạn theo; đổi khác thì link trong bài đã cũ.
  const [draftedFor, setDraftedFor] = useState({ jobs: channel.jobs, target: channel.target })
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections, enabled: open && autoPost })
  const connections = (connectionsQuery.data || []).filter((item) => item.status === 'connected' && item.network === network?.key)
  const page = connections.find((item) => item.public_id === values.connection) || connections[0]
  const jobOptions = channel.links
    .filter((link) => link.key !== 'landing' && link.key !== 'company')
    .map((link) => ({ value: link.key, label: link.label }))
  const times = plannedTimes(values)
  const stale = Boolean(values.message) && (values.target !== draftedFor.target || !sameJobs(values.jobs, draftedFor.jobs))
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
  }

  // Chèn link theo dõi vào chỗ con trỏ cuối cùng trong ô nội dung; chưa đặt con trỏ thì vào cuối bài.
  function insertLink(link) {
    const current = form.getFieldValue('message') || ''
    const [start, end] = caret.current || [current.length, current.length]
    const before = current.slice(0, start)
    const piece = `${before && !/\s$/.test(before) ? ' ' : ''}${link.url} `
    form.setFieldValue('message', `${before}${piece}${current.slice(end)}`)
    caret.current = [start + piece.length, start + piece.length]
    message.success(m.employer_campaign_composer_link_inserted({ label: linkLabel(link) }))
    requestAnimationFrame(() => {
      const textarea = document.getElementById('post-message')
      textarea?.focus()
      textarea?.setSelectionRange(...caret.current)
    })
  }

  const generate = useMutation({
    mutationFn: async () => {
      const { jobs = [], target } = form.getFieldsValue(['jobs', 'target'])
      await updateCampaignChannel(campaign.public_id, channel.public_id, { jobs, target })
      const data = await generateCampaignChannelContent(campaign.public_id, channel.public_id)
      return { ...data, scope: { jobs, target } }
    },
    onSuccess: (data) => {
      refresh()
      form.setFieldValue('message', postText(data.rendered_content))
      setDraftedFor(data.scope)
      message[data.fallback_reason ? 'info' : 'success'](FALLBACK_NOTES[data.fallback_reason]?.() || m.employer_campaign_content_ai_done())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_content_generate_error())),
  })
  const submit = useMutation({
    mutationFn: async (data) => {
      // Lưu tin, link và nội dung vào kênh trước, để link của bài tự đăng và bản nháp khớp.
      await updateCampaignChannel(campaign.public_id, channel.public_id, {
        jobs: data.jobs || [],
        target: data.target,
        ...(data.message !== initialText && { content: { body: data.message } }),
      })
      if (!autoPost) return
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
      refresh()
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      if (autoPost) {
        message.success(data.timing === 'now' ? m.employer_campaign_fb_sent({ network: network.platform }) : m.employer_campaign_fb_scheduled({ count: plannedTimes(data).length }))
      } else {
        copyText(data.message, m.employer_campaign_content_copy_label(), message)
      }
      onClose()
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelPosts(campaign.public_id, channel.public_id) })
      message.error(getApiErrorMessage(error, m.employer_campaign_fb_schedule_error()))
    },
  })

  const loadingPages = autoPost && connectionsQuery.isLoading
  const noPage = autoPost && !connectionsQuery.isLoading && !connections.length
  let submitLabel = m.employer_campaign_composer_save_copy()
  if (autoPost && values.timing === 'now') submitLabel = m.employer_campaign_fb_post_now()
  else if (autoPost && values.timing === 'series') submitLabel = m.employer_campaign_fb_schedule_count({ count: times.length })
  else if (autoPost) submitLabel = m.employer_campaign_fb_schedule()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="min(980px, 100vw)"
      title={m.employer_campaign_composer_title({ label: channel.label })}
      className="ch-composer"
      extra={(
        <Button
          type="primary"
          icon={autoPost ? null : <CopyOutlined aria-hidden />}
          loading={submit.isPending}
          disabled={noPage || loadingPages}
          onClick={() => form.submit()}
        >
          {submitLabel}
        </Button>
      )}
    >
      {loadingPages ? <Skeleton active paragraph={{ rows: 6 }} /> : noPage ? (
        <Alert
          type="info"
          showIcon
          title={m.employer_campaign_fb_no_connection({ network: network?.label })}
          description={<>{m.employer_campaign_fb_connect_prefix({ network: network?.label })}<Link to={EMPLOYER_INTEGRATIONS_URL}>{m.employer_campaign_fb_account_settings()}</Link>{m.employer_campaign_fb_connect_suffix()}</>}
        />
      ) : (
        <div className="ch-composer__grid">
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              jobs: channel.jobs,
              target: channel.target,
              message: initialText,
              connection: connections[0]?.public_id,
              timing: 'now',
              scheduled_for: presets()[0].value,
              repeats: [7],
              images: [],
            }}
            onFinish={(data) => submit.mutate(data)}
          >
            <div className="ch-composer__scope">
              <Form.Item label={m.employer_campaign_post_jobs()} name="jobs">
                <JobChips options={jobOptions} />
              </Form.Item>
              <Form.Item label={m.employer_campaign_post_target()} name="target" extra={TARGETS.find((item) => item.value === values.target)?.hint()}>
                <Select options={TARGETS.map((item) => ({ value: item.value, label: item.label() }))} />
              </Form.Item>
            </div>
            <div className="ch-composer__label">
              <label htmlFor="post-message">{m.employer_campaign_fb_content()}</label>
              <span className="ch-composer__tools">
                <Dropdown
                  trigger={['click']}
                  rootClassName="ch-linkmenu"
                  menu={{
                    items: channel.links.map((link) => ({ key: link.key, label: <span title={linkLabel(link)}>{linkLabel(link)}</span> })),
                    onClick: ({ key }) => insertLink(channel.links.find((link) => link.key === key)),
                  }}
                >
                  <Button size="small" icon={<LinkOutlined aria-hidden />}>{m.employer_campaign_composer_insert_link()}</Button>
                </Dropdown>
                <Button size="small" icon={<RobotOutlined aria-hidden />} loading={generate.isPending} onClick={() => generate.mutate()}>
                  {values.message ? m.employer_campaign_content_regenerate() : m.employer_campaign_content_generate()}
                </Button>
              </span>
            </div>
            {stale && <p className="ch-scope__stale" role="status">{m.employer_campaign_post_regenerate_hint()}</p>}
            <Form.Item
              name="message"
              className="ch-composer__message"
              extra={m.employer_campaign_composer_message_hint()}
              rules={[{ required: true, whitespace: true, message: m.employer_campaign_fb_content_required() }]}
            >
              <Input.TextArea
                id="post-message"
                autoSize={{ minRows: 7, maxRows: 14 }}
                maxLength={network?.capabilities.max_chars ?? 3000}
                showCount
                placeholder={m.employer_campaign_composer_message_placeholder()}
                onSelect={(event) => { caret.current = [event.target.selectionStart, event.target.selectionEnd] }}
              />
            </Form.Item>
            {autoPost && <SocialAccountFields campaign={campaign} channel={channel} network={network} values={values} form={form} times={times} connections={connections} />}
          </Form>
          <aside className="ch-composer__preview">
            <p className="ch-section-note">{autoPost ? m.employer_campaign_fb_preview({ network: network.platform }) : m.employer_campaign_preview_manual()}</p>
            <SocialPostPreview
              name={autoPost ? page?.account_name || network.label : channel.label}
              avatarUrl={autoPost ? page?.account_picture_url : undefined}
              meta={!autoPost ? channel.kind_label : values.timing === 'now' || !values.scheduled_for ? m.employer_campaign_fb_just_now() : when(values.scheduled_for)}
              text={values.message || ''}
              images={(values.images || []).map((image) => image.url)}
              link={channel.kind.startsWith('facebook') || channel.kind === 'threads' ? channel.link : ''}
              variant={network?.key}
              imageRatio={network?.capabilities.image_ratio}
              linkTitle={campaign.name}
            />
            {autoPost && campaign.status !== 'active' && (
              <Alert type="warning" showIcon title={m.employer_campaign_fb_not_running()} description={m.employer_campaign_fb_not_running_description()} />
            )}
          </aside>
        </div>
      )}
    </Drawer>
  )
}
