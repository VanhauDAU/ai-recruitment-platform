import { Form, Input, Modal } from 'antd'

function actionCopy(action) {
  if (action === 'uphold') {
    return {
      title: 'Xác nhận báo cáo vi phạm',
      okText: 'Xác nhận vi phạm',
      description: 'Toàn bộ tin của tài khoản đã đăng tin sẽ mất huy hiệu xác thực.',
      danger: true,
    }
  }
  if (action === 'dismiss') {
    return {
      title: 'Bác báo cáo',
      okText: 'Bác báo cáo',
      description: 'Báo cáo bị bác không ảnh hưởng đến huy hiệu xác thực.',
      danger: false,
    }
  }
  return {
    title: 'Gỡ kết luận vi phạm',
    okText: 'Gỡ kết luận',
    description: 'Huy hiệu sẽ được khôi phục nếu người đăng vẫn đạt bốn tiêu chí còn lại.',
    danger: false,
  }
}

export default function JobReportDecisionModal({
  decision,
  form,
  onCancel,
  onSubmit,
  pending,
}) {
  const copy = actionCopy(decision?.action)
  const reversing = decision?.action === 'reverse'

  return (
    <Modal
      cancelText="Hủy"
      closable={!pending}
      confirmLoading={pending}
      destroyOnHidden
      mask={{ closable: !pending }}
      okButtonProps={{ danger: copy.danger }}
      okText={copy.okText}
      onCancel={onCancel}
      onOk={onSubmit}
      open={Boolean(decision)}
      title={copy.title}
    >
      <p className="mb-4 text-sm leading-6 text-slate-600">{copy.description}</p>
      <Form form={form} layout="vertical">
        <Form.Item
          label={reversing ? 'Lý do gỡ kết luận' : 'Ghi chú xử lý'}
          name="note"
          rules={reversing
            ? [{ required: true, whitespace: true, message: 'Nhập lý do gỡ kết luận.' }]
            : []}
        >
          <Input.TextArea
            aria-label={reversing ? 'Lý do gỡ kết luận' : 'Ghi chú xử lý'}
            maxLength={1000}
            placeholder="Ghi lại căn cứ để phục vụ kiểm tra sau này."
            rows={4}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
