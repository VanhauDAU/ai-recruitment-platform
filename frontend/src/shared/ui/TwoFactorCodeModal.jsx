import { Button, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { sanitizeTwoFactorCode, TWO_FACTOR_CODE_LENGTH } from './two-factor-code'

const SUCCESS_ILLUSTRATION = 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-check.png'

function displayRemaining(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function TwoFactorCodeModal({
  email,
  expiresIn = 180,
  onCancel,
  onConfirm,
  onResend,
  open,
  success = false,
  successImage = SUCCESS_ILLUSTRATION,
  successMessage = 'Tài khoản của bạn đã được bảo vệ bằng tính năng xác minh 2 bước.',
  successTitle = 'Xác minh hai bước đã bật',
  onCloseSuccess,
}) {
  const [code, setCode] = useState('')
  const [remaining, setRemaining] = useState(expiresIn)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setCode('')
    setError('')
    setRemaining(expiresIn)
    return undefined
  }, [expiresIn, open])

  useEffect(() => {
    if (!open || success || remaining <= 0) return undefined
    const interval = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [open, remaining, success])

  async function handleConfirm() {
    if (code.length !== TWO_FACTOR_CODE_LENGTH || remaining <= 0) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(code)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Không thể xác nhận mã. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError('')
    try {
      const response = await onResend()
      setCode('')
      setRemaining(response?.expires_in || expiresIn)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Không thể gửi lại mã. Vui lòng thử lại.')
    } finally {
      setResending(false)
    }
  }

  return (
    <Modal open={open} centered footer={null} width={484} closable={!submitting} onCancel={success ? onCloseSuccess : onCancel} styles={{ content: { borderRadius: 24, padding: '22px 32px 24px' } }}>
      {success ? (
        <div className="flex flex-col items-center pb-1 pt-2 text-center">
          <img src={successImage} alt={successTitle} className="h-28 w-28 object-contain" />
          <h2 className="mt-3 text-xl font-bold text-slate-800">{successTitle}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{successMessage}</p>
          <Button type="primary" size="large" className="mt-6 min-w-40" onClick={onCloseSuccess}>Đóng</Button>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">Nhập mã xác minh</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Chúng tôi đã gửi mã xác minh tới <strong>{email}</strong><br />Bạn vui lòng kiểm tra email để lấy mã.</p>
          <Input.OTP
            aria-label="Mã xác minh 6 chữ số"
            autoComplete="one-time-code"
            className="!mt-6 !w-full !justify-center"
            formatter={sanitizeTwoFactorCode}
            length={TWO_FACTOR_CODE_LENGTH}
            onChange={(value) => setCode(sanitizeTwoFactorCode(value))}
            onInput={(cells) => setCode(sanitizeTwoFactorCode(cells.join('')))}
            type="text"
            inputMode="numeric"
            value={code}
          />
          <p className={`mt-2 text-sm ${remaining ? 'text-slate-700' : 'font-medium text-red-500'}`}>{remaining ? <>Mã hết hạn sau: <strong>{displayRemaining(remaining)}</strong></> : 'Mã đã hết hạn. Vui lòng gửi lại mã.'}</p>
          <p className="mt-1 text-sm text-slate-600">Chưa nhận được mã? <button type="button" onClick={handleResend} disabled={resending} className="cursor-pointer font-semibold text-[var(--brand-primary)] disabled:cursor-wait disabled:opacity-60">{resending ? 'Đang gửi...' : 'Gửi lại mã'}</button></p>
          {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-5"><Button size="large" shape="round" onClick={onCancel} disabled={submitting}>Hủy</Button><Button type="primary" size="large" shape="round" onClick={handleConfirm} loading={submitting} disabled={code.length !== TWO_FACTOR_CODE_LENGTH || remaining <= 0}>Xác nhận</Button></div>
        </div>
      )}
    </Modal>
  )
}
