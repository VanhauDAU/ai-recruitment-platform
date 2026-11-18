import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Empty, Form, Input, InputNumber, List, Modal } from 'antd'
import dayjs from 'dayjs'
import {
  addCampaignChannelCost,
  campaignKeys,
  deleteCampaignChannelCost,
  getCampaignChannelCosts,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`

// Sổ chi phí của một kênh: NTD tự ghi số tiền đã chi (quảng cáo, in ấn...).
export default function ChannelCostsModal({ campaignId, channel, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const key = campaignKeys.channelCosts(campaignId, channel?.public_id)
  const costsQuery = useQuery({
    queryKey: key,
    queryFn: () => getCampaignChannelCosts(campaignId, channel.public_id),
    enabled: Boolean(channel),
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaignId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.channelReport(campaignId) })
  }
  const addMutation = useMutation({
    mutationFn: (values) => addCampaignChannelCost(campaignId, channel.public_id, {
      ...values,
      incurred_on: values.incurred_on.format('YYYY-MM-DD'),
      note: values.note || '',
    }),
    onSuccess: () => {
      form.resetFields()
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ghi chi phí.')),
  })
  const deleteMutation = useMutation({
    mutationFn: (costId) => deleteCampaignChannelCost(campaignId, channel.public_id, costId),
    onSuccess: refresh,
  })

  return (
    <Modal destroyOnHidden open={Boolean(channel)} title={`Chi phí: ${channel?.label || ''}`} footer={null} onCancel={onClose}>
      <Form
        form={form}
        layout="inline"
        className="ch-cost-form"
        initialValues={{ incurred_on: dayjs() }}
        onFinish={(values) => addMutation.mutate(values)}
      >
        <Form.Item name="amount" rules={[{ required: true, message: 'Nhập số tiền.' }]}>
          <InputNumber min={1} step={100000} suffix="đ" placeholder="Số tiền" />
        </Form.Item>
        <Form.Item name="incurred_on" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" allowClear={false} />
        </Form.Item>
        <Form.Item name="note">
          <Input maxLength={255} placeholder="Ghi chú (không bắt buộc)" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={addMutation.isPending}>Ghi chi phí</Button>
      </Form>
      <List
        className="ch-cost-list"
        loading={costsQuery.isLoading}
        locale={{ emptyText: <Empty description="Chưa ghi chi phí nào" /> }}
        dataSource={costsQuery.data || []}
        renderItem={(cost) => (
          <List.Item
            actions={[
              <Button
                key="delete"
                type="text"
                size="small"
                icon={<DeleteOutlined aria-hidden />}
                aria-label="Xóa khoản chi"
                onClick={() => deleteMutation.mutate(cost.id)}
              />,
            ]}
          >
            <List.Item.Meta title={money(cost.amount)} description={`${dayjs(cost.incurred_on).format('DD/MM/YYYY')}${cost.note ? `, ${cost.note}` : ''}`} />
          </List.Item>
        )}
      />
    </Modal>
  )
}
