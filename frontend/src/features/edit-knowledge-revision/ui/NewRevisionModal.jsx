import { Input, Modal } from 'antd'

export default function NewRevisionModal({
  loading,
  open,
  required,
  summary,
  touched,
  onCancel,
  onChange,
  onConfirm,
  onTouch,
}) {
  const missingRequiredSummary = required && !summary.trim()

  return (
    <Modal
      className="knowledge-new-revision-modal"
      open={open}
      title="Tạo revision mới"
      okText="Tạo revision"
      cancelText="Hủy"
      okButtonProps={{ disabled: missingRequiredSummary, loading }}
      onCancel={onCancel}
      onOk={onConfirm}
    >
      <p className="knowledge-new-revision-modal__intro">
        Nội dung gần nhất sẽ được sao chép sang một bản nháp mới để bạn tiếp tục biên tập.
      </p>
      <label className="knowledge-new-revision-modal__label" htmlFor="knowledge-new-revision-summary">
        Tóm tắt thay đổi
        {required && <span> Bắt buộc</span>}
      </label>
      <Input.TextArea
        id="knowledge-new-revision-summary"
        rows={3}
        maxLength={500}
        showCount
        status={touched && missingRequiredSummary ? 'error' : undefined}
        value={summary}
        placeholder="Ví dụ: Cập nhật quy trình đặt lại mật khẩu và ảnh minh họa…"
        onBlur={onTouch}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="knowledge-new-revision-modal__hint">
        {required
          ? 'Bài đã xuất bản cần mô tả rõ phạm vi thay đổi để người duyệt đối chiếu.'
          : 'Mô tả ngắn giúp người duyệt hiểu mục tiêu của revision.'}
      </p>
    </Modal>
  )
}
