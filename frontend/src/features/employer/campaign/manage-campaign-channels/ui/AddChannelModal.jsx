import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal, Skeleton } from 'antd'
import { useRef } from 'react'
import { Link } from 'react-router'
import {
  CAMPAIGN_CHANNEL_KINDS,
  campaignKeys,
  ChannelIcon,
  createCampaignChannel,
  getSocialConnections,
  useSocialNetworks,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { EMPLOYER_INTEGRATIONS_URL } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { useCampaignChannels } from '../model/use-campaign-channels'

// Gợi ý ngắn cho kênh đăng tay: nơi đăng cụ thể là gì.
const MANUAL_HINTS = {
  facebook_group: () => m.employer_campaign_channel_hint_facebook_group(),
  zalo: () => m.employer_campaign_channel_hint_zalo(),
  tiktok: () => m.employer_campaign_channel_hint_tiktok(),
  email: () => m.employer_campaign_channel_hint_email(),
  website: () => m.employer_campaign_channel_hint_website(),
  qr_offline: () => m.employer_campaign_channel_hint_qr_offline(),
  other: () => m.employer_campaign_channel_hint_other(),
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

function KindTile({ kind, label, selected, onSelect, children, compact = false }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`ch-kind-tile ${compact ? 'is-compact' : ''} ${selected ? 'is-on' : ''}`}
      onClick={() => onSelect(kind)}
    >
      <ChannelIcon kind={kind} />
      <span>
        <strong>{label}</strong>
        {children}
      </span>
    </button>
  )
}

// Hai nhóm: mạng ProCV tự đăng (kèm trạng thái kết nối) và nơi NTD chép bài tự đăng.
function KindPicker({ value, onChange, networks, connections, loading }) {
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />
  const autoKinds = new Set(networks.map((network) => network.channel_kind))
  const manualKinds = CAMPAIGN_CHANNEL_KINDS.filter((kind) => !autoKinds.has(kind.value))
  const accountOf = (network) => connections.find((item) => item.network === network.key && item.status === 'connected')
  const picked = networks.find((network) => network.channel_kind === value)

  return (
    <div className="ch-kind-groups" role="radiogroup" aria-label={m.employer_campaign_add_channel_kind_aria()}>
      <section className="ch-kind-group" aria-labelledby="ch-kind-auto">
        <header>
          <h3 id="ch-kind-auto">{m.employer_campaign_add_channel_auto_title()}</h3>
          <p>{m.employer_campaign_add_channel_auto_desc()}</p>
        </header>
        <div className="ch-kinds is-auto">
          {networks.map((network) => {
            const account = accountOf(network)
            return (
              <KindTile key={network.key} kind={network.channel_kind} label={kindLabel(network.channel_kind) || network.label} selected={value === network.channel_kind} onSelect={onChange}>
                <small className={`ch-kind-status ${account ? 'is-ready' : 'is-missing'}`}>
                  {account ? <CheckCircleFilled aria-hidden /> : <ExclamationCircleFilled aria-hidden />}
                  {account
                    ? m.employer_campaign_add_channel_connected({ account: account.account_name })
                    : m.employer_campaign_add_channel_not_connected()}
                </small>
              </KindTile>
            )
          })}
        </div>
        {picked && !accountOf(picked) && (
          <p className="ch-kind-note" role="status">
            <ExclamationCircleFilled aria-hidden />
            <span>
              {m.employer_campaign_add_channel_connect_hint({ network: picked.label })}{' '}
              <Link to={EMPLOYER_INTEGRATIONS_URL}>{m.employer_campaign_add_channel_connect_link()}</Link>
            </span>
          </p>
        )}
      </section>
      <section className="ch-kind-group" aria-labelledby="ch-kind-manual">
        <header>
          <h3 id="ch-kind-manual">{m.employer_campaign_add_channel_manual_title()}</h3>
          <p>{m.employer_campaign_add_channel_manual_desc()}</p>
        </header>
        <div className="ch-kinds is-manual">
          {manualKinds.map((kind) => (
            <KindTile key={kind.value} kind={kind.value} label={kind.label} selected={value === kind.value} onSelect={onChange} compact>
              {MANUAL_HINTS[kind.value] && <small>{MANUAL_HINTS[kind.value]()}</small>}
            </KindTile>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function AddChannelModal({ campaign, open, onClose, onCreated }) {
  const [form] = Form.useForm()
  const suggestedLabel = useRef('')
  const queryClient = useQueryClient()
  const channelsQuery = useCampaignChannels(open ? campaign.public_id : null)
  const networksQuery = useSocialNetworks({ enabled: open })
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections, enabled: open })
  const networks = networksQuery.data || []
  const connections = connectionsQuery.data || []
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
      width={760}
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
        <Form.Item name="kind" rules={[{ required: true, message: m.employer_campaign_add_channel_kind_required() }]}>
          <KindPicker networks={networks} connections={connections} loading={networksQuery.isLoading || connectionsQuery.isLoading} />
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
