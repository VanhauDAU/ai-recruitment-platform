import { Checkbox, Form, Input, Modal } from 'antd'

const ACTION_COPY = {
  uphold: {
    title: 'Xác nhận báo cáo vi phạm',
    okText: 'Xác nhận vi phạm',
    description: 'Báo cáo được ghi nhận là vi phạm đã xác nhận. Trang công ty chỉ bị tạm ẩn khi bạn chọn bên dưới.',
    noteLabel: 'Ghi chú xử lý',
  },
  dismiss: {
    title: 'Bác báo cáo',
    okText: 'Bác báo cáo',
    description: 'Báo cáo bị bác không ảnh hưởng đến trang công ty.',
    noteLabel: 'Ghi chú xử lý',
  },
  reverse: {
    title: 'Gỡ kết luận',
    okText: 'Gỡ kết luận',
    description: 'Báo cáo quay lại hàng chờ xử lý. Việc này không tự khôi phục trang công ty đang tạm ẩn; khôi phục hiển thị tại tab Trang công khai của công ty.',
    noteLabel: 'Lý do gỡ kết luận',
  },
}

/**
 * Hộp thoại kết luận một báo cáo công ty. `decision` giữ nguyên `action` và
 * `report` khi đóng để tiêu đề và nút không đổi chữ trong lúc modal đang khép.
 * `canHoldPage`: tạm ẩn trang là quyền riêng (`company_page.moderate`).
 */
export default function CompanyReportDecisionModal({ canHoldPage, decision, onCancel, onSubmit, pending }) {
  const [form] = Form.useForm()
  const { action, open, report } = decision
  const copy = ACTION_COPY[action]

  async function submit() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    onSubmit({ note: values.note.trim(), applyHold: Boolean(values.apply_hold) })
  }

  return (
    <Modal
      cancelText="Hủy"
      closable={!pending}
      confirmLoading={pending}
      destroyOnHidden
      mask={{ closable: !pending }}
      okButtonProps={{ danger: action === 'uphold' }}
      okText={copy.okText}
      onCancel={onCancel}
      onOk={submit}
      open={open}
      title={copy.title}
    >
      <p className="mb-4 text-sm leading-6 text-slate-600">
        <strong className="font-semibold text-slate-900">{report?.company.display_name}</strong>
        {`: ${copy.description}`}
      </p>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label={copy.noteLabel}
          name="note"
          rules={[{ required: true, whitespace: true, message: `Nhập ${copy.noteLabel.toLocaleLowerCase('vi')}.` }]}
        >
          <Input.TextArea
            aria-label={copy.noteLabel}
            maxLength={1000}
            placeholder="Ghi lại căn cứ để phục vụ kiểm tra sau này."
            rows={4}
            showCount
          />
        </Form.Item>
        {action === 'uphold' && canHoldPage && !report?.company.content_policy_hold && (
          <Form.Item className="!mb-0" name="apply_hold" valuePropName="checked">
            <Checkbox>Đồng thời tạm ẩn trang công ty</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
