import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  FileProtectOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Modal, Progress } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
} from '@/shared/config/portals'
import { getEmployerVerificationProgress } from '../model/verification-progress'

const STEP_DEFINITIONS = [
  { key: 'phone_verified', title: 'Xác thực số điện thoại', description: 'Tăng bảo mật và độ tin cậy khi liên hệ ứng viên.', icon: PhoneOutlined, to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', title: 'Cập nhật thông tin công ty', description: 'Tìm doanh nghiệp đã có hoặc tạo hồ sơ công ty mới.', icon: BankOutlined, to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_submitted', title: 'Cập nhật Giấy đăng ký doanh nghiệp', description: 'Tải giấy tờ pháp lý sau khi đã liên kết đúng công ty.', icon: FileProtectOutlined, to: EMPLOYER_BUSINESS_LICENSE_URL },
  { key: 'candidate_dpa_submitted', title: 'Cập nhật Thỏa thuận xử lý DLCN với ứng viên', description: 'Đăng tải văn bản cho phép thu thập và sử dụng dữ liệu ứng viên.', icon: FileProtectOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'dpa_accepted', title: 'Đồng ý Thỏa thuận xử lý DLCN với nền tảng', description: 'Xác nhận vai trò và trách nhiệm bảo vệ dữ liệu trên hệ thống.', icon: SafetyCertificateOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
]

export default function EmployerVerificationChecklist({ profile, onContinue }) {
  const { user } = useSession()
  const { settings, siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false)
  const verification = profile?.onboarding || {}
  const progress = getEmployerVerificationProgress(verification)
  const hotline = settingText(settings.hotline, '1900 1234')
  const supportEmail = settingText(settings.support_email, 'cskh@procv.vn')

  function openStep(step) {
    if (step.key === 'phone_verified' && !user?.has_usable_password) {
      setPasswordPromptOpen(true)
      return
    }
    if (step.to) navigate(step.to)
  }

  function stepAction(step) {
    if (verification[step.key]) return <span className="text-xs font-bold text-emerald-600">Hoàn tất</span>
    const actionLabel = step.title.startsWith('Cập nhật') ? step.title : `Cập nhật ${step.title}`
    return <Button type="text" aria-label={actionLabel} icon={<ArrowRightOutlined />} onClick={() => openStep(step)} />
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Xác thực thông tin</h2>
          <p className="mt-1 text-sm text-slate-500">Hoàn thiện dần để tăng độ tin cậy của tài khoản.</p>
        </div>
        <strong className="text-sm text-emerald-600">Hoàn thành {progress.percent}%</strong>
      </div>
      <Progress percent={progress.percent} showInfo={false} strokeColor="#00b14f" railColor="#e8edf2" className="!mb-6" />

      <div className="divide-y divide-slate-100">
        {STEP_DEFINITIONS.map((step) => {
          const Icon = step.icon
          const done = Boolean(verification[step.key])
          return (
            <div key={step.key} className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {done ? <CheckCircleFilled className="text-xl" /> : <Icon className="text-lg" />}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-bold ${done ? 'text-slate-600' : 'text-slate-900'}`}>{step.title.replace('nền tảng', siteName)}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
              </div>
              <div className="shrink-0">{stepAction(step)}</div>
            </div>
          )
        })}
      </div>

      <Button type="link" onClick={onContinue} className="!mt-6 !w-full !text-slate-500">
        Tôi sẽ xác thực thêm sau
      </Button>

      <Modal
        open={passwordPromptOpen}
        onCancel={() => setPasswordPromptOpen(false)}
        footer={null}
        title="Hãy chắc chắn bạn muốn thực hiện hành động này"
      >
        <div className="space-y-4 text-sm leading-6 text-slate-600">
          <p>Nhằm đảm bảo an toàn cho tài khoản, vui lòng nhập mật khẩu tài khoản để xác nhận việc thực hiện hành động này.</p>
          <p>Tài khoản của bạn chưa có mật khẩu do được đăng ký bằng Google, vui lòng cập nhật mật khẩu trước khi xác thực số điện thoại.</p>
          <Button type="primary" block size="large" onClick={() => navigate(EMPLOYER_PASSWORD_SETTINGS_URL)}>
            Cập nhật mật khẩu tại đây
          </Button>
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5">
            Mọi thắc mắc xin liên hệ Phòng vận hành dịch vụ để được hỗ trợ:<br />
            Hotline CSKH: <a href={`tel:${hotline.replace(/[^+\d]/g, '')}`} className="font-bold text-emerald-700">{hotline}</a><br />
            Email: <a href={`mailto:${supportEmail}`} className="font-bold text-emerald-700">{supportEmail}</a>
          </div>
        </div>
      </Modal>
    </div>
  )
}
