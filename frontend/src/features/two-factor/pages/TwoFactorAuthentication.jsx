import { CheckCircleFilled } from '@ant-design/icons'
import { useState } from 'react'
import {
  confirmTwoFactorDisable,
  confirmTwoFactorSetup,
  sendTwoFactorDisableCode,
  sendTwoFactorSetupCode,
} from '../api/twoFactorService'
import TwoFactorCodeModal from '../components/TwoFactorCodeModal'
import { useAuth } from '@/features/auth'

const SETUP_ILLUSTRATION = 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-gears.png'
const SUCCESS_ILLUSTRATION = 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-check.png'

export default function TwoFactorAuthentication() {
  const { user, setAuthenticatedUser } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [expiresIn, setExpiresIn] = useState(180)
  const [error, setError] = useState('')
  const [action, setAction] = useState('enable')

  async function startAction(nextAction) {
    setSending(true)
    setError('')
    setAction(nextAction)
    try {
      const response = nextAction === 'disable' ? await sendTwoFactorDisableCode() : await sendTwoFactorSetupCode()
      setEmail(response.email || user?.email || '')
      setExpiresIn(response.expires_in || 180)
      setModalOpen(true)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Không thể gửi mã xác minh. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  async function confirmAction(code) {
    const updatedUser = action === 'disable' ? await confirmTwoFactorDisable(code) : await confirmTwoFactorSetup(code)
    setAuthenticatedUser(updatedUser)
    setSuccess(true)
  }

  async function resendCode() {
    const response = action === 'disable' ? await sendTwoFactorDisableCode() : await sendTwoFactorSetupCode()
    setEmail(response.email || email)
    setExpiresIn(response.expires_in || 180)
    return response
  }

  function closeModal() {
    setModalOpen(false)
    setSuccess(false)
  }

  const enabled = user?.two_factor_enabled

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-41 items-center justify-between gap-5 px-6 py-6 sm:px-8">
          <div className="max-w-lg">
            <h1 className="text-lg font-bold text-slate-800 sm:text-xl">
              {enabled ? 'Xác minh 2 bước đang được bật' : 'Bật tính năng xác minh 2 bước'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {enabled
                ? 'Mỗi lần đăng nhập, chúng tôi sẽ gửi mã xác minh tới email của bạn để bảo vệ tài khoản.'
                : 'Bảo vệ dữ liệu cá nhân và giữ tài khoản luôn nằm trong tầm kiểm soát của bạn bằng 1 lớp bảo mật nữa.'}
            </p>
            {enabled ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)]"><CheckCircleFilled /> Tài khoản đã được bảo vệ</p>
                <button
                  type="button"
                  onClick={() => startAction('disable')}
                  disabled={sending}
                  className="cursor-pointer text-sm font-semibold text-red-500 underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60"
                >
                  {sending && action === 'disable' ? 'Đang gửi mã...' : 'Tắt xác minh 2 bước'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startAction('enable')}
                disabled={sending}
                className="mt-4 cursor-pointer rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-wait disabled:opacity-70"
              >
                {sending ? 'Đang gửi mã...' : 'Xác minh 2 bước'}
              </button>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
          </div>
          <img
            src={enabled ? 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-check.png' : SETUP_ILLUSTRATION}
            alt="Bảo vệ tài khoản"
            className="hidden h-32 w-36 shrink-0 object-contain sm:block"
          />
          
        </div>
      </div>

      <TwoFactorCodeModal
        open={modalOpen}
        email={email}
        expiresIn={expiresIn}
        success={success}
        onCancel={closeModal}
        onConfirm={confirmAction}
        onResend={resendCode}
        onCloseSuccess={closeModal}
        successImage={action === 'disable' ? SETUP_ILLUSTRATION : SUCCESS_ILLUSTRATION}
        successTitle={action === 'disable' ? 'Đã tắt xác minh hai bước' : 'Xác minh hai bước đã bật'}
        successMessage={action === 'disable' ? 'Tài khoản của bạn đã tắt tính năng xác minh 2 bước.' : undefined}
      />
    </section>
  )
}
