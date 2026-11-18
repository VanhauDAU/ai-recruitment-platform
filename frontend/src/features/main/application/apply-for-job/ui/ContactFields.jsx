import { Input } from 'antd'

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
 */
export default function ContactFields({ name, email, phone, onNameChange, onEmailChange, onPhoneChange }) {
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
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Họ tên hiển thị với Nhà tuyển dụng"
        />
      </Field>
      <div className="af-contact__grid">
        <Field label="Email">
          <Input
            type="email"
            aria-label="Email ứng tuyển"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Email hiển thị với Nhà tuyển dụng"
          />
        </Field>
        <Field label="Số điện thoại">
          <Input
            type="tel"
            aria-label="Số điện thoại ứng tuyển"
            autoComplete="tel"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="Số điện thoại hiển thị với Nhà tuyển dụng"
          />
        </Field>
      </div>
    </div>
  )
}
