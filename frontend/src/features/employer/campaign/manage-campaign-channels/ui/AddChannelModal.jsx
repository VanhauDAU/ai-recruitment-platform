import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal, Radio, Select } from 'antd'
import { CAMPAIGN_CHANNEL_KINDS, campaignKeys, createCampaignChannel } from '@/entities/campaign/campaign'
import { getEmployerJobs } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ChannelIcon from './ChannelIcon'

const HINTS = {
  facebook_page: 'ProCV tự đăng',
  facebook_group: 'Đăng tay, có nội dung soạn sẵn',
  qr_offline: 'In mã QR lên tờ rơi',
}
const kindLabel = (kind) => CAMPAIGN_CHANNEL_KINDS.find((item) => item.value === kind)?.label || ''

function KindPicker({ value, onChange }) {
  return (
    <div className="ch-kinds" role="radiogroup" aria-label="Loại kênh">
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
      message.success('Đã thêm kênh. Link theo dõi đã sẵn sàng.')
      form.resetFields()
      onCreated?.(channel)
      onClose()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thêm kênh.')),
  })

  return (
    <Modal
      destroyOnHidden
      open={open}
      width={680}
      title="Thêm kênh phân phối"
      okText="Thêm kênh"
      cancelText="Hủy"
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
        <Form.Item label="Bạn sẽ đăng ở đâu?" name="kind" rules={[{ required: true, message: 'Chọn loại kênh.' }]}>
          <KindPicker />
        </Form.Item>
        <Form.Item
          label="Tên để phân biệt"
          name="label"
          extra="Ví dụ: Nhóm IT Hà Nội. Mỗi nơi đăng là một kênh riêng để so sánh hiệu quả."
          rules={[{ required: true, whitespace: true, message: 'Nhập tên kênh.' }]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item label="Link dẫn tới" name="target">
          <Radio.Group
            options={[
              { value: 'landing', label: 'Trang tuyển dụng của chiến dịch' },
              { value: 'job', label: 'Một tin cụ thể' },
            ]}
          />
        </Form.Item>
        {target === 'job' && (
          <Form.Item label="Tin" name="job" rules={[{ required: true, message: 'Chọn tin.' }]}>
            <Select
              loading={jobsQuery.isLoading}
              options={(jobsQuery.data || []).map((job) => ({ value: job.public_id, label: job.title }))}
              placeholder="Chọn tin trong chiến dịch"
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
