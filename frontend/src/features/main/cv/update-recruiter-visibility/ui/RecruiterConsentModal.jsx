import { Checkbox, Modal } from 'antd'
import { useState } from 'react'

/** Hộp đồng ý mở hồ sơ cho NTD; nút xác nhận chỉ bật sau khi tick cam kết. */
export default function RecruiterConsentModal({ open, loading, onConfirm, onCancel }) {
  const [confirmed, setConfirmed] = useState(false)
  const close = () => {
    setConfirmed(false)
    onCancel()
  }

  return (
    <Modal
      open={open}
      title="Cho phép nhà tuyển dụng tìm kiếm hồ sơ?"
      okText="Xác nhận cho phép"
      cancelText="Để sau"
      okButtonProps={{ disabled: !confirmed, loading, className: '!bg-[var(--brand-primary)]' }}
      onOk={async () => {
        await onConfirm()
        setConfirmed(false)
      }}
      onCancel={close}
    >
      <div className="space-y-4 text-sm leading-6 text-slate-600">
        <p>Khi tính năng tìm ứng viên ra mắt, nhà tuyển dụng có thể tìm thấy và xem kinh nghiệm, học vấn, kỹ năng trên những CV bạn bật.</p>
        <p className="rounded-lg bg-[var(--brand-primary-soft)] p-3 text-[var(--brand-primary-hover)]">Họ tên, ảnh, số điện thoại, email và địa chỉ vẫn được ẩn cho tới khi bạn đồng ý lời mời kết nối.</p>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
          Tôi đã đọc và đồng ý mở hồ sơ cho nhà tuyển dụng tìm kiếm.
        </Checkbox>
      </div>
    </Modal>
  )
}
