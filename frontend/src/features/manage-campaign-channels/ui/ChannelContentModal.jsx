import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal, Select } from 'antd'
import { campaignKeys, updateCampaignChannel } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

// Sửa tay nội dung bài đăng; {link} được thay bằng link theo dõi của kênh khi sao chép.
export default function ChannelContentModal({ campaignId, channel, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (content) => updateCampaignChannel(campaignId, channel.public_id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaignId) })
      message.success('Đã lưu nội dung.')
      onClose()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu nội dung.')),
  })

  return (
    <Modal
      destroyOnHidden
      open={Boolean(channel)}
      width={640}
      title={`Nội dung đăng: ${channel?.label || ''}`}
      okText="Lưu nội dung"
      cancelText="Hủy"
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ hashtags: [], ...channel?.content }}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Form.Item label="Tiêu đề" name="headline">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label="Nội dung" name="body" extra="Giữ chuỗi {link} ở chỗ đặt link ứng tuyển.">
          <Input.TextArea rows={8} maxLength={3000} showCount />
        </Form.Item>
        <Form.Item label="Hashtag" name="hashtags">
          <Select mode="tags" maxCount={10} tokenSeparators={[',', ' ']} />
        </Form.Item>
        <Form.Item label="Lời kêu gọi" name="call_to_action">
          <Input maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
