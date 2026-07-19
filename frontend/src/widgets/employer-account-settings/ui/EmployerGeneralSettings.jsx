import {
  InfoCircleFilled,
  KeyOutlined,
  MailOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { App, Switch, Tooltip } from 'antd'
import { useState } from 'react'
import { useSession } from '@/entities/session'
import {
  confirmTwoFactorDisable,
  confirmTwoFactorSetup,
  sendTwoFactorDisableCode,
  sendTwoFactorSetupCode,
} from '@/features/two-factor'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import TwoFactorCodeModal from '@/shared/ui/TwoFactorCodeModal'

const SUCCESS_ILLUSTRATION = 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-check.png'
const SETUP_ILLUSTRATION = 'https://cdn-new.topcv.vn/unsafe/https://static.topcv.vn/v4/image/icon/icon-shield-gears.png'

function StatusBadge({ active }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      {active ? 'Đang hoạt động' : 'Đang tắt'}
    </span>
  )
}

function MethodRow({ icon, title, description, checked, loading, disabled, onChange, tooltip }) {
  const control = <Switch checked={checked} loading={loading} disabled={disabled} onChange={onChange} />
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {tooltip ? <Tooltip title={tooltip}>{control}</Tooltip> : control}
    </div>
  )
}

export default function EmployerGeneralSettings() {
  const { user, setCurrentUser } = useSession()
  const { message } = App.useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [expiresIn, setExpiresIn] = useState(180)
  const [action, setAction] = useState('enable')

  const twoFactorEnabled = Boolean(user?.two_factor_enabled)

  async function startEmailAction(nextAction) {
    setSending(true)
    setAction(nextAction)
    try {
      const response = nextAction === 'disable' ? await sendTwoFactorDisableCode() : await sendTwoFactorSetupCode()
      setEmail(response.email || user?.email || '')
      setExpiresIn(response.expires_in || 180)
      setModalOpen(true)
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng thử lại.'))
    } finally {
      setSending(false)
    }
  }

  async function confirmAction(code) {
    const updated = action === 'disable' ? await confirmTwoFactorDisable(code) : await confirmTwoFactorSetup(code)
    setCurrentUser(updated)
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

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-lg border border-slate-200 p-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600"><MailOutlined /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-800">Thông báo CV ứng tuyển</p>
            <StatusBadge active />
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">Tự động gửi email khi ứng viên ứng tuyển vào tin tuyển dụng của bạn</p>
        </div>
        <Tooltip title="Thông báo email luôn được bật; tùy chọn cấu hình sẽ có ở giai đoạn tiếp theo.">
          <Switch checked disabled />
        </Tooltip>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SafetyCertificateOutlined className="text-slate-600" />
          <p className="text-sm font-bold text-slate-800">Xác thực 2 yếu tố</p>
          <StatusBadge active={twoFactorEnabled} />
        </div>

        {!twoFactorEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-md border-l-4 border-blue-400 bg-blue-50 p-3 text-sm leading-6 text-slate-700">
            <InfoCircleFilled className="mt-0.5 shrink-0 text-blue-500" />
            <span>Vui lòng bật tính năng Xác thực bảo mật để tăng cường an toàn cho tài khoản của bạn.</span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <MethodRow
            icon={<MobileOutlined />}
            title="Sử dụng Ứng dụng xác thực"
            description="Lấy mã OTP qua ứng dụng Google Authenticator hoặc ứng dụng tương tự"
            checked={false}
            disabled
            tooltip="Phương thức này sẽ được mở trong giai đoạn tiếp theo."
          />
          <MethodRow
            icon={<MailOutlined />}
            title="Sử dụng Email"
            description="Lấy mã OTP qua email đăng ký tài khoản"
            checked={twoFactorEnabled}
            loading={sending}
            disabled={sending}
            onChange={(checked) => startEmailAction(checked ? 'enable' : 'disable')}
          />
          <MethodRow
            icon={<KeyOutlined />}
            title="Sử dụng Mã dự phòng"
            description="Dùng khi không lấy được mã OTP qua ứng dụng hoặc email"
            checked={false}
            disabled
            tooltip="Phương thức này sẽ được mở trong giai đoạn tiếp theo."
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
        successTitle={action === 'disable' ? 'Đã tắt xác thực 2 yếu tố' : 'Đã bật xác thực 2 yếu tố'}
        successMessage={action === 'disable'
          ? 'Tài khoản của bạn đã tắt xác thực 2 yếu tố qua email.'
          : 'Từ giờ mỗi lần đăng nhập sẽ cần mã xác minh gửi tới email của bạn.'}
      />
    </div>
  )
}
