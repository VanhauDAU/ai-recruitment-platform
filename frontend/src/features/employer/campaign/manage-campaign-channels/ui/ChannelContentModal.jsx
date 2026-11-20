import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal, Select } from 'antd'
import { campaignKeys, updateCampaignChannel } from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

// Sửa tay nội dung bài đăng; {link} và {link:<mã tin>} được thay bằng link theo dõi của kênh.
export default function ChannelContentModal({ campaignId, channel, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (content) => updateCampaignChannel(campaignId, channel.public_id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.channels(campaignId) })
      message.success(m.employer_campaign_content_modal_saved())
      onClose()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_campaign_content_modal_save_error())),
  })

  return (
    <Modal
      destroyOnHidden
      open={Boolean(channel)}
      width={640}
      title={m.employer_campaign_content_modal_title({ label: channel?.label || '' })}
      okText={m.employer_campaign_content_modal_ok()}
      cancelText={m.employer_campaign_cancel()}
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
        <Form.Item label={m.employer_campaign_content_modal_headline()} name="headline">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item label={m.employer_campaign_fb_content()} name="body" extra={m.employer_campaign_content_modal_body_extra({ token: '{link}', jobToken: '{link:jb_…}' })}>
          <Input.TextArea rows={8} maxLength={3000} showCount />
        </Form.Item>
        <Form.Item label="Hashtag" name="hashtags">
          <Select mode="tags" maxCount={10} tokenSeparators={[',', ' ']} />
        </Form.Item>
        <Form.Item label={m.employer_campaign_content_modal_cta()} name="call_to_action">
          <Input maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
