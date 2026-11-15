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
      okButtonProps={{ disabled: !confirmed, loading, className: '!bg-[#00b14f]' }}
      onOk={async () => {
        await onConfirm()
        setConfirmed(false)
      }}
      onCancel={close}
    >
      <div className="space-y-4 text-sm leading-6 text-slate-600">
        <p>Nhà tuyển dụng có thể xem kinh nghiệm, học vấn và kỹ năng trên CV để gửi lời mời kết nối phù hợp.</p>
        <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Họ tên, ảnh, số điện thoại, email và địa chỉ vẫn được ẩn cho tới khi bạn đồng ý lời mời kết nối.</p>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
          Tôi đã đọc và đồng ý mở hồ sơ cho nhà tuyển dụng tìm kiếm.
        </Checkbox>
      </div>
    </Modal>
  )
}
