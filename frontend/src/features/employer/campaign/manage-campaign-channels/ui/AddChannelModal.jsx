import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal, Radio, Select } from 'antd'
import { CAMPAIGN_CHANNEL_KINDS, campaignKeys, createCampaignChannel } from '@/entities/campaign/campaign'
import { getEmployerJobs } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import ChannelIcon from './ChannelIcon'

const HINTS = {
  facebook_page: m.employer_campaign_channel_hint_facebook_page(),
  facebook_group: m.employer_campaign_channel_hint_facebook_group(),
  qr_offline: m.employer_campaign_channel_hint_qr_offline(),
}
const kindLabel = (kind) => CAMPAIGN_CHANNEL_KINDS.find((item) => item.value === kind)?.label || ''

function KindPicker({ value, onChange }) {
  return (
    <div className="ch-kinds" role="radiogroup" aria-label={m.employer_campaign_add_channel_kind_aria()}>
      {CAMPAIGN_CHANNEL_KINDS.map((kind) => (
        <button
          key={kind.value}
          type="button"
          role="radio"
          aria-checked={value === kind.value}
          className={`ch-kind-tile ${value === kind.value ? 'is-on' : ''}`}
          onClick={() => onChange(kind.value)}
        >
          <ChannelIcon kind={kind.value} />
          <span>
            <strong>{kind.label}</strong>
            {HINTS[kind.value] && <small>{HINTS[kind.value]}</small>}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function AddChannelModal({ campaign, open, onClose, onCreated }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const target = Form.useWatch('target', form)
  const jobsQuery = useQuery({
    queryKey: ['jobs', 'mine', { campaign: campaign.public_id }],
    queryFn: () => getEmployerJobs({ campaign: campaign.public_id }),
    enabled: open,
  })
  const mutation = useMutation({
    mutationFn: (values) => createCampaignChannel(campaign.public_id, values),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaign.public_id) })
      queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaign.public_id) })
      message.success(m.employer_campaign_add_channel_success())
      form.resetFields()
      onCreated?.(channel)
      onClose()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_add_channel_error())),
  })

  return (
    <Modal
      destroyOnHidden
      open={open}
      width={680}
      title={m.employer_campaign_add_channel_title()}
      okText={m.employer_campaign_health_action_add_channel()}
      cancelText={m.employer_campaign_cancel()}
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ target: 'landing' }}
        onFinish={(values) => mutation.mutate({ ...values, label: values.label.trim() })}
        onValuesChange={(changed) => {
          if (changed.kind && !form.isFieldTouched('label')) form.setFieldValue('label', kindLabel(changed.kind))
        }}
      >
        <Form.Item label={m.employer_campaign_add_channel_where()} name="kind" rules={[{ required: true, message: m.employer_campaign_add_channel_kind_required() }]}>
          <KindPicker />
        </Form.Item>
        <Form.Item
          label={m.employer_campaign_add_channel_label()}
          name="label"
          extra={m.employer_campaign_add_channel_label_extra()}
          rules={[{ required: true, whitespace: true, message: m.employer_campaign_add_channel_label_required() }]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item label={m.employer_campaign_add_channel_target()} name="target">
          <Radio.Group
            options={[
              { value: 'landing', label: m.employer_campaign_add_channel_target_landing() },
              { value: 'job', label: m.employer_campaign_add_channel_target_job() },
            ]}
          />
        </Form.Item>
        {target === 'job' && (
          <Form.Item label={m.employer_campaign_add_channel_job()} name="job" rules={[{ required: true, message: m.employer_campaign_add_channel_job_required() }]}>
            <Select
              loading={jobsQuery.isLoading}
              options={(jobsQuery.data || []).map((job) => ({ value: job.public_id, label: job.title }))}
              placeholder={m.employer_campaign_add_channel_job_placeholder()}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
