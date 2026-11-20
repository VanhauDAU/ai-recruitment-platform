import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal } from 'antd'
import { useRef } from 'react'
import {
  CAMPAIGN_CHANNEL_KINDS,
  campaignKeys,
  ChannelIcon,
  createCampaignChannel,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { useCampaignChannels } from '../model/use-campaign-channels'

const HINTS = {
  facebook_page: m.employer_campaign_channel_hint_auto_post(),
  instagram: m.employer_campaign_channel_hint_auto_post(),
  threads: m.employer_campaign_channel_hint_auto_post(),
  facebook_group: m.employer_campaign_channel_hint_facebook_group(),
  qr_offline: m.employer_campaign_channel_hint_qr_offline(),
}
const kindLabel = (kind) => CAMPAIGN_CHANNEL_KINDS.find((item) => item.value === kind)?.label || ''
const normalize = (label) => label.trim().toLowerCase()

// Tên gợi ý không được trùng kênh đã có (backend bắt tên duy nhất trong chiến dịch),
// trùng thì đánh số tiếp. Một kênh đăng được nhiều bài cho nhiều tin, nên tên chỉ
// để phân biệt nơi đăng (ví dụ hai nhóm Facebook khác nhau).
function suggestLabel(kind, takenLabels) {
  const base = kindLabel(kind)
  let label = base
  for (let index = 2; takenLabels.has(normalize(label)); index += 1) label = `${base} ${index}`
  return label
}

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
  const suggestedLabel = useRef('')
  const queryClient = useQueryClient()
  const channelsQuery = useCampaignChannels(open ? campaign.public_id : null)
  const takenLabels = new Set((channelsQuery.data || []).map((channel) => normalize(channel.label)))
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
        onFinish={(values) => mutation.mutate({ ...values, label: values.label.trim() })}
        onValuesChange={(changed, values) => {
          // Chỉ ghi đè khi tên vẫn là tên đã gợi ý (người dùng chưa tự sửa).
          if (!changed.kind || (values.label && values.label !== suggestedLabel.current)) return
          suggestedLabel.current = suggestLabel(changed.kind, takenLabels)
          form.setFieldValue('label', suggestedLabel.current)
        }}
      >
        <Form.Item label={m.employer_campaign_add_channel_where()} name="kind" rules={[{ required: true, message: m.employer_campaign_add_channel_kind_required() }]}>
          <KindPicker />
        </Form.Item>
        <Form.Item
          label={m.employer_campaign_add_channel_label()}
          name="label"
          extra={m.employer_campaign_add_channel_label_extra()}
          rules={[
            { required: true, whitespace: true, message: m.employer_campaign_add_channel_label_required() },
            {
              validator: (_, value) => (value && takenLabels.has(normalize(value))
                ? Promise.reject(new Error(m.employer_campaign_add_channel_label_taken()))
                : Promise.resolve()),
            },
          ]}
        >
          <Input maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
