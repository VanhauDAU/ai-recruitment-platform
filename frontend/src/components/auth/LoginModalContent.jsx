import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import Login from '../../pages/main/auth/Login'

// Gom reCAPTCHA + form đăng nhập vào một module để lazy-load cùng nhau — giữ cả
// hai ra khỏi bundle chính (chỉ nạp khi mở popup đăng nhập). Xem LoginPromptProvider.
export default function LoginModalContent({ onSuccess }) {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
      <Login onSuccess={onSuccess} />
    </GoogleReCaptchaProvider>
  )
}
