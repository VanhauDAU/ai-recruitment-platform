import {
  ArrowRightOutlined,
  CopyOutlined,
  DownloadOutlined,
  InfoCircleFilled,
  KeyOutlined,
  MailOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Input, Modal, QRCode, Radio, Switch, Tooltip } from 'antd'
import { useState } from 'react'
import { useSession } from '@/entities/session'
import {
  confirmEmployerTotpSetup,
  confirmTwoFactorDisable,
  confirmTwoFactorSetup,
  disableEmployerTwoFactorMethod,
  generateEmployerBackupCodes,
  sendEmployerMethodDisableCode,
  sendEmployerBackupCodesCode,
  sendTwoFactorDisableCode,
  sendTwoFactorSetupCode,
  startEmployerTotpSetup,
} from '@/features/two-factor'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { sanitizeTwoFactorCode, TWO_FACTOR_CODE_LENGTH } from '@/shared/ui/two-factor-code'
import TwoFactorCodeModal from '@/shared/ui/TwoFactorCodeModal'

function StatusBadge({ active, activeLabel = 'Đang hoạt động' }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      {active ? activeLabel : 'Đang tắt'}
    </span>
  )
}

function MethodRow({ id, icon, title, description, checked, loading, disabled, onChange, tooltip }) {
  const control = <Switch checked={checked} loading={loading} disabled={disabled} onChange={onChange} />
  return (
    <div data-testid={`two-factor-method-${id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 p-3 sm:gap-4 sm:p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {tooltip ? <Tooltip title={tooltip}>{control}</Tooltip> : control}
    </div>
  )
}

function BackupCodesModal({ codes, email, onClose }) {
  const copyCodes = async () => {
    await navigator.clipboard?.writeText(codes.join('\n'))
    message.success('Đã sao chép mã dự phòng.')
  }
  const downloadCodes = () => {
    const content = ['Backup Codes – TopCV', '', 'Giữ các mã này ở nơi an toàn.', 'Mỗi mã chỉ sử dụng được một lần.', '', ...codes.map((code) => `- ${code}`), '', 'Nếu bạn làm mất các mã này, vui lòng tạo mã mới trong phần Cài đặt.'].join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `TOPCV-BACKUP-CODES-${String(email || 'employer').replace(/[^a-z0-9@._-]/gi, '_')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Modal open={codes.length > 0} footer={null} title="Mã dự phòng" onCancel={onClose} centered>
      <p className="text-sm leading-6 text-slate-600">Các mã dưới đây chỉ hiển thị một lần. Mỗi mã dùng được một lần khi bạn không thể xác thực bằng ứng dụng hoặc email.</p>
      <div className="my-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 font-mono text-sm font-bold text-slate-800 sm:grid-cols-3 sm:gap-3 sm:p-4 sm:text-base">
        {codes.map((code) => <span key={code}>{code}</span>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button icon={<CopyOutlined />} onClick={copyCodes}>Sao chép mã</Button>
        <Button icon={<DownloadOutlined />} onClick={downloadCodes}>Tải xuống</Button>
      </div>
      <div className="mt-5 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-3 text-sm leading-6 text-slate-700"><InfoCircleFilled className="mr-2 text-blue-500" />Không chia sẻ các mã này với bất kỳ ai.</div>
      <div className="mt-5 text-right"><Button type="primary" onClick={onClose}>Tôi đã lưu lại</Button></div>
    </Modal>
  )
}

function StepNumber({ children }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-600">{children}</span>
}

function formatManualKey(manualKey) {
  return String(manualKey || '').replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || ''
}

function TotpSetupModal({ setup, code, error, submitting, onCancel, onCodeChange, onConfirm }) {
  const [copied, setCopied] = useState(false)

  if (!setup) return null

  async function copyManualKey() {
    try {
      await navigator.clipboard?.writeText(String(setup.manual_key).replace(/\s/g, ''))
      setCopied(true)
      message.success('Đã sao chép mã thiết lập.')
    } catch {
      message.error('Không thể sao chép mã. Vui lòng sao chép thủ công.')
    }
  }

  return (
    <Modal
      open={Boolean(setup)}
      title="Bật xác thực 2 yếu tố"
      width={680}
      footer={null}
      onCancel={onCancel}
      centered
      className="employer-totp-modal"
    >
      <form onSubmit={(event) => {
        event.preventDefault()
        if (code.length === TWO_FACTOR_CODE_LENGTH) onConfirm()
      }}>
        <p className="mb-5 text-base font-semibold text-slate-600">Hướng dẫn thiết lập:</p>
        <div className="space-y-5">
          <div className="flex gap-3">
            <StepNumber>1</StepNumber>
            <div>
              <h3 className="text-base font-bold text-slate-800">Mở ứng dụng xác thực</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Sử dụng Google Authenticator hoặc ứng dụng tương tự. <a href="https://support.google.com/accounts/answer/1066447" target="_blank" rel="noreferrer" className="font-medium text-emerald-500 hover:text-emerald-600">Xem hướng dẫn</a></p>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber>2</StepNumber>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-800">Quét mã QR</h3>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="w-fit rounded-lg border border-slate-300 bg-white p-2"><QRCode value={setup.otpauth_url} size={154} bordered={false} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 text-slate-500">Dùng mã này nếu bạn không quét được QR hoặc cần thiết lập lại ứng dụng xác thực:</p>
                  <code aria-label="Mã thiết lập thủ công" className="mt-3 block break-all rounded bg-slate-100 px-3 py-2 font-mono text-sm font-semibold tracking-[0.08em] text-slate-700">{formatManualKey(setup.manual_key)}</code>
                  <Button aria-label="Sao chép mã" className="mt-3 !h-9 !rounded-full !border-slate-400 !px-4 !text-slate-600" icon={<CopyOutlined />} onClick={copyManualKey}>{copied ? 'Đã sao chép' : 'Sao chép mã'}</Button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <StepNumber>3</StepNumber>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-800">Nhập mã xác thực</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Sau khi quét, ứng dụng sẽ tạo mã gồm 6 chữ số. Nhấn Enter hoặc Tiếp tục để hoàn tất thiết lập.</p>
              <Input.OTP aria-label="Mã ứng dụng xác thực" length={TWO_FACTOR_CODE_LENGTH} value={code} formatter={sanitizeTwoFactorCode} onChange={(value) => onCodeChange(sanitizeTwoFactorCode(value))} className="!mt-4 !w-full !justify-center" />
              {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
            </div>
          </div>
        </div>
        <div className="mt-7 border-t border-slate-100 pt-4">
          <Button aria-label="Tiếp tục" htmlType="submit" type="primary" size="large" block icon={<ArrowRightOutlined />} iconPlacement="end" loading={submitting} disabled={code.length !== TWO_FACTOR_CODE_LENGTH}>Tiếp tục</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function EmployerGeneralSettings() {
  const { user, setCurrentUser } = useSession()
  const [verification, setVerification] = useState(null)
  const [sending, setSending] = useState(false)
  const [backupCodes, setBackupCodes] = useState([])
  const [totpSetup, setTotpSetup] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpSubmitting, setTotpSubmitting] = useState(false)
  const [totpError, setTotpError] = useState('')

  const emailEnabled = Boolean(user?.two_factor_email_enabled ?? user?.two_factor_enabled)
  const totpEnabled = Boolean(user?.two_factor_totp_enabled)
  const backupEnabled = Boolean(user?.two_factor_backup_codes_enabled)
  const twoFactorEnabled = emailEnabled || totpEnabled

  function applyUserResponse(response) {
    const { backup_codes: codes = [], ...nextUser } = response
    setCurrentUser(nextUser)
    if (codes.length) setBackupCodes(codes)
  }

  async function startEmailAction(action) {
    setSending(true)
    try {
      const response = action === 'email-disable'
        ? await sendTwoFactorDisableCode()
        : action === 'backup'
          ? await sendEmployerBackupCodesCode()
          : await sendTwoFactorSetupCode()
      setVerification({ action, method: action === 'backup' ? 'email' : undefined, email: response.email || user?.email || '', expiresIn: response.expires_in || 180 })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng thử lại.'))
    } finally {
      setSending(false)
    }
  }

  async function confirmEmailAction(code) {
    const response = verification.action === 'method-disable'
      ? await disableEmployerTwoFactorMethod(verification.target, verification.method, code)
      : verification.action === 'email-disable'
      ? await confirmTwoFactorDisable(code)
      : verification.action === 'backup'
        ? await generateEmployerBackupCodes(code, verification.method || 'email')
        : await confirmTwoFactorSetup(code)
    applyUserResponse(response)
    setVerification(null)
    message.success(verification.action === 'method-disable' || verification.action === 'email-disable' ? 'Đã cập nhật phương thức xác thực.' : 'Đã cập nhật xác thực hai yếu tố.')
  }

  async function resendEmailAction() {
    const action = verification.action
    const response = action === 'method-disable'
      ? await sendEmployerMethodDisableCode(verification.target)
      : action === 'email-disable'
      ? await sendTwoFactorDisableCode()
      : action === 'backup'
        ? await sendEmployerBackupCodesCode()
        : await sendTwoFactorSetupCode()
    setVerification((current) => ({ ...current, email: response.email || current.email, expiresIn: response.expires_in || 180 }))
    return response
  }

  function startBackupAction() {
    if (backupEnabled) {
      startMethodDisable('backup')
      return
    }
    const method = availableBackupMethods()[0]?.value
    if (method === 'email') {
      startEmailAction('backup')
      return
    }
    if (method === 'totp') setVerification({ action: 'backup', method })
  }

  function availableBackupMethods() {
    return [
      totpEnabled && { value: 'totp', label: 'Ứng dụng xác thực' },
      emailEnabled && { value: 'email', label: 'Nhận mã qua Email' },
    ].filter(Boolean)
  }

  function availableDisableMethods(target) {
    return [
      totpEnabled && { value: 'totp', label: 'Ứng dụng xác thực' },
      emailEnabled && { value: 'email', label: 'Email' },
      target !== 'backup' && backupEnabled && { value: 'backup', label: 'Mã dự phòng' },
    ].filter(Boolean)
  }

  async function startMethodDisable(target) {
    const method = availableDisableMethods(target)[0]?.value
    if (!method) return
    if (method !== 'email') {
      setVerification({ action: 'method-disable', target, method })
      return
    }
    setSending(true)
    try {
      const response = await sendEmployerMethodDisableCode(target)
      setVerification({ action: 'method-disable', target, method, email: response.email || user?.email || '', expiresIn: response.expires_in || 180 })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng thử lại.'))
    } finally {
      setSending(false)
    }
  }

  function availableVerificationMethods() {
    return verification?.action === 'backup'
      ? availableBackupMethods()
      : availableDisableMethods(verification?.target)
  }

  async function selectVerificationMethod(method) {
    if (verification.method === method) return
    if (method !== 'email') {
      setVerification((current) => ({ ...current, method, email: '', expiresIn: 180 }))
      return
    }
    setSending(true)
    try {
      const response = verification.action === 'backup'
        ? await sendEmployerBackupCodesCode()
        : await sendEmployerMethodDisableCode(verification.target)
      setVerification((current) => ({ ...current, method, email: response.email || user?.email || '', expiresIn: response.expires_in || 180 }))
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng thử lại.'))
    } finally {
      setSending(false)
    }
  }

  async function startTotp() {
    setSending(true)
    try {
      setTotpSetup(await startEmployerTotpSetup())
      setTotpCode('')
      setTotpError('')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể khởi tạo ứng dụng xác thực.'))
    } finally {
      setSending(false)
    }
  }

  async function confirmTotp() {
    if (totpCode.length !== TWO_FACTOR_CODE_LENGTH) return
    setTotpSubmitting(true)
    setTotpError('')
    try {
      const response = await confirmEmployerTotpSetup(totpCode)
      applyUserResponse(response)
      setTotpSetup(null)
      message.success('Đã bật ứng dụng xác thực.')
    } catch (error) {
      setTotpError(getApiErrorMessage(error, 'Mã xác thực không đúng.'))
    } finally {
      setTotpSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-slate-200 p-3 sm:gap-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600"><MailOutlined /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-800">Thông báo CV ứng tuyển</p><StatusBadge active /></div><p className="mt-1 text-sm leading-6 text-slate-500">Tự động gửi email khi ứng viên ứng tuyển vào tin tuyển dụng của bạn</p></div>
        <Tooltip title="Thông báo email luôn được bật; tùy chọn cấu hình sẽ có ở giai đoạn tiếp theo."><Switch checked disabled /></Tooltip>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><SafetyCertificateOutlined className="text-slate-600" /><p className="text-sm font-bold text-slate-800">Xác thực 2 yếu tố</p><StatusBadge active={twoFactorEnabled} activeLabel="Đang bật" /></div>
        {!twoFactorEnabled && <div className="mt-4 flex items-start gap-2 rounded-md border-l-4 border-blue-400 bg-blue-50 p-3 text-sm leading-6 text-slate-700"><InfoCircleFilled className="mt-0.5 shrink-0 text-blue-500" /><span>Vui lòng bật tính năng Xác thực bảo mật để tăng cường an toàn cho tài khoản của bạn.</span></div>}
        <div className="mt-4 space-y-3">
          <MethodRow id="totp" icon={<MobileOutlined />} title="Sử dụng Ứng dụng xác thực" description="Quét QR bằng Google Authenticator hoặc ứng dụng tương tự" checked={totpEnabled} loading={sending} disabled={sending} onChange={(checked) => checked ? startTotp() : startMethodDisable('totp')} />
          <MethodRow id="email" icon={<MailOutlined />} title="Sử dụng Email" description="Lấy mã OTP qua email đăng ký tài khoản" checked={emailEnabled} loading={sending} disabled={sending} onChange={(checked) => checked ? startEmailAction('email-enable') : startMethodDisable('email')} />
          <MethodRow id="backup" icon={<KeyOutlined />} title="Sử dụng Mã dự phòng" description="Dùng khi không lấy được mã OTP qua ứng dụng hoặc email" checked={backupEnabled} loading={sending} disabled={sending || !twoFactorEnabled} tooltip={!twoFactorEnabled ? 'Hãy bật xác thực email hoặc ứng dụng xác thực trước.' : undefined} onChange={startBackupAction} />
        </div>
      </div>

      <TwoFactorCodeModal open={Boolean(verification)} email={verification?.email} expiresIn={verification?.expiresIn || 180} onCancel={() => setVerification(null)} onConfirm={confirmEmailAction} onResend={resendEmailAction} showResend={verification?.action === 'method-disable' ? verification.method === 'email' : verification?.method !== 'totp'} title={verification?.action === 'method-disable' ? `Xác nhận tắt ${verification.target === 'email' ? 'Email' : verification.target === 'totp' ? 'ứng dụng xác thực' : 'mã dự phòng'}` : verification?.action === 'backup' ? 'Xác nhận tạo mã dự phòng' : undefined} description={verification?.action === 'method-disable' && verification.method === 'totp' ? 'Nhập mã 6 chữ số từ ứng dụng xác thực để xác nhận thay đổi.' : verification?.action === 'method-disable' && verification.method === 'backup' ? 'Nhập mã dự phòng 8 chữ số để xác nhận thay đổi.' : verification?.action === 'backup' && verification.method === 'totp' ? 'Nhập mã 6 chữ số từ ứng dụng xác thực để tạo mã dự phòng.' : undefined} codeLength={verification?.method === 'backup' ? 8 : TWO_FACTOR_CODE_LENGTH} methodOptions={(verification?.action === 'method-disable' || verification?.action === 'backup') && <div className="mt-4 text-left"><p className="mb-2 text-sm font-medium text-slate-700">Xác minh bằng</p><Radio.Group value={verification.method} onChange={(event) => selectVerificationMethod(event.target.value)} disabled={sending || totpSubmitting}><div className="flex flex-wrap gap-x-4 gap-y-2">{availableVerificationMethods().map((option) => <Radio key={option.value} value={option.value}>{option.label}</Radio>)}</div></Radio.Group></div>} success={false} />
      <TotpSetupModal setup={totpSetup} code={totpCode} error={totpError} submitting={totpSubmitting} onCancel={() => setTotpSetup(null)} onCodeChange={setTotpCode} onConfirm={() => confirmTotp()} />
      <BackupCodesModal codes={backupCodes} email={user?.email} onClose={() => setBackupCodes([])} />
    </div>
  )
}
