import { Input } from 'antd'
import { memo, useState } from 'react'
import { isContactComplete } from '../model/use-apply-form'

function Field({ label, children }) {
  return (
    <label>
      <span className="af-contact__label">{label} <span className="af-required">*</span></span>
      {children}
    </label>
  )
}

/**
 * Thông tin liên hệ gửi kèm một CV dạng tệp: nhà tuyển dụng nhận nguyên tệp gốc
 * nên đây là họ tên, email, số điện thoại duy nhất hệ thống có ở dạng trường dữ liệu.
 * Chữ đang gõ ở state riêng và `valuesRef` (dùng chung giữa các lựa chọn CV, đọc
 * lúc nộp); modal chỉ vẽ lại khi `onCompleteChange` báo đủ/thiếu thay đổi.
 */
function ContactFields({ valuesRef, onCompleteChange }) {
  const [values, setValues] = useState(() => valuesRef.current)
  const change = (field) => (event) => {
    const next = { ...valuesRef.current, [field]: event.target.value }
    valuesRef.current = next
    setValues(next)
    onCompleteChange(isContactComplete(next))
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <div className="af-contact__head">
        <p className="af-contact__lead">Vui lòng nhập đầy đủ thông tin chi tiết:</p>
        <p className="af-contact__note">(*) Thông tin bắt buộc.</p>
      </div>
      <Field label="Họ và tên">
        <Input
          aria-label="Họ và tên ứng tuyển"
          autoComplete="name"
          value={values.name}
          onChange={change('name')}
          placeholder="Họ tên hiển thị với Nhà tuyển dụng"
        />
      </Field>
      <div className="af-contact__grid">
        <Field label="Email">
          <Input
            type="email"
            aria-label="Email ứng tuyển"
            autoComplete="email"
            value={values.email}
            onChange={change('email')}
            placeholder="Email hiển thị với Nhà tuyển dụng"
          />
        </Field>
        <Field label="Số điện thoại">
          <Input
            type="tel"
            aria-label="Số điện thoại ứng tuyển"
            autoComplete="tel"
            value={values.phone}
            onChange={change('phone')}
            placeholder="Số điện thoại hiển thị với Nhà tuyển dụng"
          />
        </Field>
      </div>
    </div>
  )
}

export default memo(ContactFields)
