import { SafetyCertificateOutlined } from '@ant-design/icons'
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
  codeLength = TWO_FACTOR_CODE_LENGTH,
  description,
  methodOptions,
  showResend = true,
  title = 'Nhập mã xác minh',
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
  }, [codeLength, expiresIn, open])

  useEffect(() => {
    if (!open || success || remaining <= 0) return undefined
    const interval = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [open, remaining, success])

  async function handleConfirm() {
    if (code.length !== codeLength || (showResend && remaining <= 0)) return
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
    <Modal open={open} centered footer={null} width={580} closable={!submitting} onCancel={success ? onCloseSuccess : onCancel} styles={{ content: { borderRadius: 20, padding: '0' } }}>
      {success ? (
        <div className="flex flex-col items-center px-7 pb-7 pt-8 text-center">
          <img src={successImage} alt={successTitle} className="h-28 w-28 object-contain" />
          <h2 className="mt-3 text-xl font-bold text-slate-800">{successTitle}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{successMessage}</p>
          <Button type="primary" size="large" className="mt-6 min-w-40" onClick={onCloseSuccess}>Đóng</Button>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); handleConfirm() }}>
          <div className="px-6 pb-6 pt-7 text-center sm:px-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600"><SafetyCertificateOutlined /></span>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">{title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description || <>Chúng tôi đã gửi mã xác minh tới <strong className="font-semibold text-slate-800">{email}</strong>. Vui lòng kiểm tra hộp thư để tiếp tục.</>}</p>
            <Input.OTP
              aria-label={`Mã xác minh ${codeLength} chữ số`}
              autoComplete="one-time-code"
              autoFocus
              className="!mt-7 !w-full !justify-center [&_input]:!h-12 [&_input]:!w-11 [&_input]:!rounded-xl [&_input]:!border-slate-300 [&_input]:!text-lg [&_input]:!font-bold sm:[&_input]:!w-12"
              formatter={(value) => sanitizeTwoFactorCode(value, codeLength)}
              length={codeLength}
              onChange={(value) => setCode(sanitizeTwoFactorCode(value, codeLength))}
              onInput={(cells) => setCode(sanitizeTwoFactorCode(cells.join(''), codeLength))}
              type="text"
              inputMode="numeric"
              value={code}
            />
            {showResend && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"><p className={remaining ? 'text-slate-700' : 'font-medium text-red-500'}>{remaining ? <>Mã hết hạn sau <strong>{displayRemaining(remaining)}</strong></> : 'Mã đã hết hạn. Vui lòng gửi lại mã.'}</p><p className="mt-1 text-slate-600">Chưa nhận được mã? <button type="button" onClick={handleResend} disabled={resending} className="cursor-pointer font-semibold text-[var(--brand-primary)] hover:underline disabled:cursor-wait disabled:opacity-60">{resending ? 'Đang gửi...' : 'Gửi lại mã'}</button></p></div>}
            {methodOptions}
            {error && <p role="alert" className="mt-4 text-sm font-medium text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3 border-t border-slate-100 px-6 py-4 sm:px-8"><Button size="large" className="flex-1 !rounded-lg" onClick={onCancel} disabled={submitting}>Hủy</Button><Button htmlType="submit" type="primary" size="large" className="flex-1 !rounded-lg" loading={submitting} disabled={code.length !== codeLength || (showResend && remaining <= 0)}>Xác nhận</Button></div>
        </form>
      )}
    </Modal>
  )
}
