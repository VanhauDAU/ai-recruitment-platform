import { CheckCircleFilled, CloseCircleFilled, LockOutlined } from '@ant-design/icons'
import { Alert, Form, Input, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset, validatePasswordResetToken } from '../api/authService'
import { getApiErrorMessage } from '@/shared/api/errorMapper'
import AuthLogo from '../components/AuthLogo'
import { AuthFormStyles } from '../components/LoginForm'
import PasswordRequirements from '../components/PasswordRequirements'
import { passwordValidationRule } from '../components/passwordValidation'
import { adminPath, EMPLOYER_LOGIN_URL, MAIN_LOGIN_URL } from '@/shared/config/portals'

// Sau khi đổi mật khẩu, đưa user về đúng cổng đăng nhập của role họ.
const LOGIN_URL_BY_ROLE = {
  employer: EMPLOYER_LOGIN_URL,
  admin: adminPath('/login'),
}
const loginUrlFor = (role) => LOGIN_URL_BY_ROLE[role] || MAIN_LOGIN_URL

// Bước 2: mở link trong email (`?token=`). Token được kiểm tra trước (không bị
// tiêu) để hiện ngay màn "link hết hạn" thay vì để user gõ xong mật khẩu mới báo lỗi.
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')

  const [checking, setChecking] = useState(true)
  const [account, setAccount] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }
    validatePasswordResetToken(token)
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setChecking(false))
  }, [token])

  async function onFinish(values) {
    setError('')
    setLoading(true)
    try {
      const res = await confirmPasswordReset({ token, password: values.password })
      setDone(loginUrlFor(res.role))
    } catch (err) {
      const data = err.response?.data
      setError(data?.password?.[0] || getApiErrorMessage(err, 'Đặt lại mật khẩu thất bại, vui lòng thử lại.'))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex w-full justify-center py-10">
        <Spin size="large" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full text-center">
        <AuthFormStyles />
        <div className="login-card">
          <CheckCircleFilled className="text-5xl" style={{ color: 'var(--brand-primary)' }} />
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Đã đổi mật khẩu</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Mật khẩu mới đã sẵn sàng. Các thiết bị đang đăng nhập trước đó sẽ bị đăng xuất.
          </p>
          <button
            type="button"
            onClick={() => (done.startsWith('http') ? window.location.assign(done) : navigate(done))}
            className="submit-btn mt-6 w-full rounded-full px-6 py-3.5 text-base font-bold text-white cursor-pointer"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    )
  }

  if (!token || !account) {
    return (
      <div className="w-full text-center">
        <AuthFormStyles />
        <div className="login-card">
          <CloseCircleFilled className="text-5xl text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Liên kết không còn hiệu lực</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Liên kết đặt lại mật khẩu đã hết hạn, đã được sử dụng, hoặc bạn đã yêu cầu một liên kết mới hơn.
          </p>
          <Link to="/forgot-password" className="mt-6 inline-block">
            <span className="submit-btn inline-block rounded-full px-8 py-3 text-base font-bold text-white cursor-pointer">
              Gửi lại liên kết
            </span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <AuthFormStyles />

      <div className="login-card mb-7 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tạo mật khẩu mới</h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Cho tài khoản <strong className="text-gray-700 dark:text-gray-300">{account.email}</strong>
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon closable onClose={() => setError('')} className="mb-4 !rounded-xl login-field" />
      )}

      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <div className="login-field">
          <Form.Item
            name="password"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mật khẩu mới</span>}
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }, { validator: passwordValidationRule }]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập mật khẩu mới"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
          <PasswordRequirements password={password} />
        </div>

        <div className="login-field">
          <Form.Item
            name="confirm"
            dependencies={['password']}
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nhập lại mật khẩu</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator: (_, value) => (
                  !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu nhập lại không khớp'))
                ),
              }),
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập lại mật khẩu mới"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field pt-1">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn w-full rounded-full px-6 py-3.5 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </button>
        </div>
      </Form>
    </div>
  )
}
