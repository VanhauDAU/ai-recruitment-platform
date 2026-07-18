import { CheckCircleFilled, CloseCircleFilled, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal, Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { changeEmail, confirmVerification, sendVerificationEmail } from '@/features/auth'
import { useSession } from '@/entities/session'
import { useSiteSetting, useSiteSettings } from '@/entities/site-settings'

// Trang /tai-khoan/xac-thuc-email: có `?token=` -> xác nhận từ link email;
// không có token -> màn gửi/gửi lại email xác thực cho tài khoản đang đăng nhập.
export default function VerifyEmail({
  homePath = '/',
  loginPath = '/login',
  verificationPath = '/tai-khoan/xac-thuc-email',
  successActionLabel = 'Vào trang chủ',
  verifiedActionLabel = 'Vào trang chủ',
}) {
  const [params] = useSearchParams()
  const token = params.get('token')
  const initiallySent = params.get('registered') === '1'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-10 sm:py-16">
      {token ? (
        <ConfirmToken token={token} homePath={homePath} loginPath={loginPath} verificationPath={verificationPath} actionLabel={successActionLabel} />
      ) : (
        <RequestVerification homePath={homePath} loginPath={loginPath} initiallySent={initiallySent} actionLabel={verifiedActionLabel} />
      )}
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      {children}
    </div>
  )
}

// Xác nhận email bằng token trong link (không cần đăng nhập).
function ConfirmToken({ token, homePath, loginPath, verificationPath, actionLabel }) {
  const { user, refreshSession } = useSession()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    confirmVerification(token)
      .then(async (res) => {
        setStatus('success')
        setMessage(res.detail || 'Xác thực email thành công.')
        try {
          await refreshSession()
        } catch {
          /* chưa đăng nhập ở tab này — không sao, token đã xác nhận trên server */
        }
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.')
      })
  }, [token, refreshSession])

  return (
    <Card>
      <div className="flex flex-col items-center text-center">
        {status === 'loading' && (
          <>
            <Spin size="large" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Đang xác thực email của bạn...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircleFilled className="text-5xl" style={{ color: 'var(--brand-primary)' }} />
            <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Xác thực thành công!</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{message}</p>
            <Link to={homePath} className="mt-6">
              <Button type="primary" size="large" className="!rounded-full !px-8">{actionLabel}</Button>
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <CloseCircleFilled className="text-5xl text-red-500" />
            <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Xác thực thất bại</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{message}</p>
            <Link to={user ? verificationPath : loginPath} className="mt-6">
              <Button type="primary" size="large" className="!rounded-full !px-8">Gửi lại email xác thực</Button>
            </Link>
          </>
        )}
      </div>
    </Card>
  )
}

// Màn gửi / gửi lại email xác thực cho tài khoản đang đăng nhập.
function RequestVerification({ homePath, loginPath, initiallySent, actionLabel }) {
  const { user, loading, refreshSession } = useSession()
  const { siteName } = useSiteSettings()
  const hotline = useSiteSetting('hotline', '1900 1234')
  const supportEmail = useSiteSetting('support_email', 'support@procv.vn')
  const navigate = useNavigate()

  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(initiallySent ? {
    type: 'success',
    msg: 'Tài khoản đã được tạo. Email xác thực đã được gửi tới địa chỉ đăng ký.',
  } : null)
  const [showChange, setShowChange] = useState(false)

  useEffect(() => {
    if (!loading && !user) navigate(loginPath)
  }, [loading, user, navigate, loginPath])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  if (loading || !user) {
    return (
      <Card>
        <div className="flex justify-center py-6"><Spin size="large" /></div>
      </Card>
    )
  }

  if (user.email_verified) {
    return (
      <Card>
        <div className="flex flex-col items-center text-center">
          <CheckCircleFilled className="text-5xl" style={{ color: 'var(--brand-primary)' }} />
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Email đã được xác thực</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Tài khoản {user.email} đã sẵn sàng sử dụng.</p>
          <Link to={homePath} className="mt-6">
            <Button type="primary" size="large" className="!rounded-full !px-8">{actionLabel}</Button>
          </Link>
        </div>
      </Card>
    )
  }

  async function handleSend() {
    setSending(true)
    setFeedback(null)
    try {
      const res = await sendVerificationEmail()
      setFeedback({ type: 'success', msg: res.detail })
      setCooldown(res.retry_after || 60)
    } catch (err) {
      if (err.response?.status === 429) {
        setCooldown(err.response.data?.retry_after || 60)
        setFeedback({ type: 'info', msg: err.response.data?.detail })
      } else {
        setFeedback({ type: 'error', msg: err.response?.data?.detail || 'Gửi email thất bại, vui lòng thử lại.' })
      }
    } finally {
      setSending(false)
    }
  }

  async function handleChanged() {
    await refreshSession()
    setCooldown(60)
    setFeedback({ type: 'success', msg: 'Đã gửi email xác thực tới địa chỉ email mới.' })
  }

  return (
    <>
      <Card>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/40">
            <MailOutlined className="text-3xl" style={{ color: 'var(--brand-primary)' }} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Xác thực địa chỉ email</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Xác thực email <strong className="text-gray-900 dark:text-white">{user.email}</strong> để được đảm bảo
            các quyền lợi và sự hỗ trợ tốt nhất từ {siteName}.
          </p>
        </div>

        {feedback && (
          <Alert
            type={feedback.type}
            message={feedback.msg}
            showIcon
            className="!mt-5 !rounded-xl"
            closable
            onClose={() => setFeedback(null)}
          />
        )}

        <div className="mt-5">
          <Button
            type="primary"
            size="large"
            block
            loading={sending}
            disabled={cooldown > 0}
            onClick={handleSend}
            className="!h-11 !rounded-full !font-bold"
          >
            {cooldown > 0 ? `Gửi lại email xác thực sau ${cooldown}s` : 'Gửi email xác thực'}
          </Button>
          {cooldown > 0 && (
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Bạn chưa nhận được mail? Gửi lại email xác thực sau {cooldown}s.
            </p>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowChange(true)}
            className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
          >
            Tôi muốn thay đổi địa chỉ email khác
          </button>
        </div>
      </Card>

      {/* Khắc phục lỗi thường gặp */}
      <div className="mt-5 w-full rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Khắc phục lỗi thường gặp</h3>
        <ol className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li>
            <span className="font-semibold">1.</span> Địa chỉ email không chính xác?{' '}
            <button type="button" onClick={() => setShowChange(true)} className="font-medium text-[var(--brand-primary)] hover:underline">
              Hãy bấm vào đây để thay đổi
            </button>
          </li>
          <li>
            <span className="font-semibold">2.</span> Không thấy email trong hòm thư đến? Hãy kiểm tra hòm thư{' '}
            <strong>Spam</strong> hoặc{' '}
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={handleSend}
              className="font-medium text-[var(--brand-primary)] hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              bấm gửi lại
            </button>
            .
          </li>
        </ol>
        <p className="mt-4 border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-500 dark:border-zinc-700 dark:text-gray-400">
          Mọi thắc mắc vui lòng liên hệ bộ phận CSKH của {siteName}:{' '}
          <a href={`tel:${hotline.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline">
            <PhoneOutlined className="text-[11px]" />
            {hotline}
          </a>{' '}
          &middot;{' '}
          <a href={`mailto:${supportEmail}`} className="font-semibold text-[var(--brand-primary)] hover:underline">
            {supportEmail}
          </a>
        </p>
      </div>

      <ChangeEmailModal open={showChange} onClose={() => setShowChange(false)} onChanged={handleChanged} />
    </>
  )
}

function ChangeEmailModal({ open, onClose, onChanged }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(values) {
    setLoading(true)
    setError('')
    try {
      await changeEmail(values.email)
      await onChanged()
      form.resetFields()
      onClose()
    } catch (err) {
      const data = err.response?.data
      setError(data?.email?.[0] || data?.detail || 'Đổi email thất bại, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Thay đổi địa chỉ email"
      onCancel={onClose}
      okText="Cập nhật & gửi lại"
      okButtonProps={{ loading }}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <p className="mb-4 text-sm text-gray-500">
        Nhập địa chỉ email mới. Chúng tôi sẽ gửi lại liên kết xác thực tới email này.
      </p>
      {error && <Alert type="error" message={error} showIcon className="mb-4 !rounded-lg" />}
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email mới"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input size="large" prefix={<MailOutlined className="text-[var(--brand-primary)]" />} placeholder="ten@email.com" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
