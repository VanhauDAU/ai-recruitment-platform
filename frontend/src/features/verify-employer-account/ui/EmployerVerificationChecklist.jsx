import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Alert, Button, Modal, Progress, Tag } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_CONSULTING_NEED_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
} from '@/shared/config/portals'
import { getEmployerVerificationProgress } from '../model/verification-progress'

const STEP_DEFINITIONS = [
  { key: 'email_verified', title: 'Xác minh email', description: 'Xác nhận địa chỉ email đăng nhập của tài khoản.', icon: SafetyCertificateOutlined },
  { key: 'registration_completed', title: 'Hoàn tất hồ sơ nhà tuyển dụng', description: 'Cập nhật đầy đủ thông tin cá nhân và chức danh.', icon: SafetyCertificateOutlined },
  { key: 'consulting_need_completed', title: 'Khai báo nhu cầu tuyển dụng', description: 'Cho biết vị trí và quy mô tuyển dụng dự kiến.', icon: SafetyCertificateOutlined, to: EMPLOYER_CONSULTING_NEED_URL },
  { key: 'phone_verified', title: 'Xác thực số điện thoại', description: 'Tăng bảo mật và độ tin cậy khi liên hệ ứng viên.', icon: PhoneOutlined, to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', title: 'Cập nhật thông tin công ty', description: 'Tìm doanh nghiệp đã có hoặc tạo hồ sơ công ty mới.', icon: BankOutlined, to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_submitted', title: 'Nộp giấy tờ chứng minh quyền đại diện', description: 'Tải GPKD hoặc bộ giấy ủy quyền và định danh.', icon: FileProtectOutlined, to: EMPLOYER_BUSINESS_LICENSE_URL },
  { key: 'business_doc_approved', title: 'Giấy tờ doanh nghiệp được duyệt', description: 'Admin đã đối chiếu giấy tờ với công ty liên kết.', icon: FileProtectOutlined },
  { key: 'candidate_dpa_approved', title: 'Văn bản xử lý dữ liệu được duyệt', description: 'Nộp văn bản xử lý dữ liệu ứng viên và chờ admin phê duyệt.', icon: FileProtectOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'dpa_accepted', title: 'Đồng ý Thỏa thuận xử lý DLCN với nền tảng', description: 'Xác nhận vai trò và trách nhiệm bảo vệ dữ liệu trên hệ thống.', icon: SafetyCertificateOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'representative_verified', title: 'Admin duyệt tài khoản', description: 'Mở quyền gửi duyệt tin và làm việc với hồ sơ ứng viên.', icon: SafetyCertificateOutlined },
]

export default function EmployerVerificationChecklist({ profile, onContinue }) {
  const { user } = useSession()
  const { settings, siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false)
  const verification = profile?.onboarding || {}
  const verificationCase = profile?.verification_case || {}
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

      {verificationCase.status !== 'draft' && (
        <Alert
          className="!mb-5"
          showIcon
          type={{
            approved: 'success',
            rejected: 'error',
            changes_requested: 'warning',
          }[verificationCase.status] || 'info'}
          title={(
            <span>
              {verificationCase.status_label}
              <Tag className="ml-2">{`Hồ sơ lần ${verificationCase.revision || 1}`}</Tag>
            </span>
          )}
          description={verificationCase.decision_reason || (
            verificationCase.status === 'pending' || verificationCase.status === 'in_review'
              ? 'Hồ sơ đang được kiểm tra. Bạn vẫn có thể dùng dashboard và chỉnh sửa tin nháp.'
              : 'Hoàn thiện các bước còn thiếu để gửi hồ sơ xác thực.'
          )}
        />
      )}

      <div className="divide-y divide-slate-100">
        {STEP_DEFINITIONS.map((step) => {
          const Icon = step.icon
          const done = Boolean(verification[step.key])
          return (
            <div key={step.key} className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {done
                  ? <CheckCircleFilled className="text-xl" />
                  : step.to
                    ? <Icon className="text-lg" />
                    : <ClockCircleOutlined className="text-lg" />}
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
