import { RocketOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal } from 'antd'
import { campaignKeys, createCampaign } from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

export default function CreateCampaignModal({
  open,
  onClose,
  onCreated,
}) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      form.resetFields()
      onClose()
      onCreated(campaign)
      message.success('Đã tạo và mở chiến dịch.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể tạo chiến dịch.'),
    ),
  })

  return (
    <Modal
      destroyOnHidden
      open={open}
      title={(
        <span className="inline-flex items-center gap-2">
          <RocketOutlined className="text-emerald-600" />
          Tạo chiến dịch tuyển dụng
        </span>
      )}
      okText="Tạo chiến dịch"
      cancelText="Hủy"
      okButtonProps={{
        className: '!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !px-5 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!shadow-lg active:!translate-y-0',
      }}
      cancelButtonProps={{
        className: '!h-10 !rounded-xl !border-slate-200 !px-4 !font-semibold !text-slate-600 hover:!border-slate-300 hover:!bg-slate-50 hover:!text-slate-900',
      }}
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={({ name }) => mutation.mutate({ name: name.trim() })}
      >
        <Form.Item
          label="Tên chiến dịch tuyển dụng"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
        >
          <Input
            autoFocus
            maxLength={255}
            placeholder="Ví dụ: Tuyển dụng nhân viên Marketing tháng 10"
            onPressEnter={(event) => {
              if (!event.nativeEvent.isComposing) {
                event.preventDefault()
                form.submit()
              }
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
