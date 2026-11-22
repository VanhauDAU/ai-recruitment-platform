import { CheckOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import './identity-recovery.css'

const STEPS = ['Đổi email', 'Gửi link mật khẩu', 'Người dùng hoàn tất']

/**
 * Tiến trình khôi phục quyền truy cập: đổi email → gửi link đặt mật khẩu → người dùng tự hoàn tất.
 * Chỉ hiện khi đã bắt đầu (đã đổi email); gồm thanh 3 bước và đúng một việc tiếp theo cùng nút của nó.
 */
export default function IdentityRecoveryGuide({
  account,
  emailCompleted = false,
  passwordResetAction,
  passwordResetSent = false,
}) {
  const emailDone = emailCompleted || (
    account.email_verified === false
    && account.has_usable_password === false
  )
  const userCompleted = passwordResetSent
    && account.email_verified
    && account.has_usable_password
  // Số bước đã xong: 0 chưa bắt đầu, 1 đã đổi email, 2 đã gửi link, 3 hoàn tất.
  const done = userCompleted ? 3 : (passwordResetSent ? 2 : (emailDone ? 1 : 0))
  if (done === 0) return null

  const next = [
    null,
    {
      title: 'Tiếp theo: gửi link đặt lại mật khẩu',
      description: `Người dùng sẽ tự đặt mật khẩu mới qua ${account.email}.`,
      action: passwordResetAction,
    },
    {
      title: 'Đã gửi link — đang chờ người dùng',
      description: 'Người dùng đặt mật khẩu, đăng nhập lại rồi liên kết lại OAuth nếu cần.',
    },
    {
      title: 'Khôi phục danh tính đã hoàn tất',
      description: 'Email đã được xác minh và người dùng đã có mật khẩu mới.',
    },
  ][done]

  return (
    <section aria-labelledby="identity-recovery-title" className="admin-panel idr">
      <div className="idr__head">
        <span className="idr__icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
        <div className="idr__intro">
          <h2 id="identity-recovery-title" className="idr__title">Khôi phục quyền truy cập</h2>
          <p className="idr__subtitle">Không có mật khẩu tạm — người dùng tự đặt mật khẩu mới qua email.</p>
        </div>
      </div>

      <div className="idr__body">
        <ol className="idr__steps" style={{ '--idr-progress': Math.min(done, 2) / 2 }}>
          {STEPS.map((label, index) => {
            const state = index < done ? 'is-done' : (index === done ? 'is-current' : '')
            return (
              <li key={label} className={`idr__step ${state}`} aria-current={index === done ? 'step' : undefined}>
                <span className="idr__dot">{index < done ? <CheckOutlined aria-hidden="true" /> : index + 1}</span>
                <span className="idr__label">{label}</span>
              </li>
            )
          })}
        </ol>
        <div key={done} className={`idr__next ${done === 3 ? 'is-complete' : ''}`} role="status">
          <div className="idr__next-text">
            <strong>{next.title}</strong>
            <span>{next.description}</span>
          </div>
          {next.action && <div className="idr__action">{next.action}</div>}
        </div>
      </div>
    </section>
  )
}
