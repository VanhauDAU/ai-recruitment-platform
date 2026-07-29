import {
  CheckCircleFilled,
  ClockCircleOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Tag, Typography } from 'antd'

const CARD_TONES = {
  active: 'border-blue-300 bg-blue-50 shadow-sm',
  done: 'border-emerald-200 bg-emerald-50',
  wait: 'border-slate-200 bg-slate-50',
}

const NUMBER_TONES = {
  active: 'bg-blue-600 text-white',
  done: 'bg-emerald-600 text-white',
  wait: 'bg-slate-200 text-slate-500',
}

function RecoveryStepCard({
  action,
  description,
  icon,
  number,
  status = 'wait',
  statusLabel,
  title,
}) {
  return (
    <article
      className={`flex min-h-52 flex-col rounded-xl border p-4 transition-colors ${CARD_TONES[status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${NUMBER_TONES[status]}`}
        >
          {status === 'done' ? <CheckCircleFilled /> : number}
        </span>
        <Tag color={status === 'active' ? 'blue' : (status === 'done' ? 'green' : 'default')}>
          {statusLabel}
        </Tag>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={status === 'wait' ? 'text-slate-400' : 'text-slate-700'}>
          {icon}
        </span>
        <Typography.Text strong className={status === 'wait' ? '!text-slate-500' : ''}>
          {title}
        </Typography.Text>
      </div>
      <Typography.Paragraph className="!mb-4 !mt-2 !text-sm !leading-6 !text-slate-600">
        {description}
      </Typography.Paragraph>
      <div className="mt-auto">
        {action || (
          <Typography.Text type="secondary" className="!text-xs">
            {status === 'wait' ? 'Hoàn tất bước trước để tiếp tục' : 'Không cần thao tác'}
          </Typography.Text>
        )}
      </div>
    </article>
  )
}

export default function IdentityRecoveryGuide({
  account,
  emailAction,
  emailCompleted = false,
  mfaAction,
  mfaCompleted = false,
  passwordResetAction,
  passwordResetSent = false,
}) {
  const hasMfa = Boolean(
    account.mfa_methods.email
    || account.mfa_methods.totp
    || account.mfa_methods.backup_codes_remaining > 0,
  )
  const emailDone = emailCompleted || (
    account.email_verified === false
    && account.has_usable_password === false
  )
  const mfaDone = mfaCompleted || (emailDone && !hasMfa)
  const userCompleted = passwordResetSent
    && account.email_verified
    && account.has_usable_password

  let nextStep = {
    tone: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: <MailOutlined />,
    title: 'Bắt đầu bằng việc đổi email đăng nhập',
    description: 'Hệ thống sẽ thu hồi mật khẩu, phiên và OAuth cũ.',
  }
  if (emailDone && !mfaDone) {
    nextStep = {
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: <SafetyCertificateOutlined />,
      title: 'Tiếp theo: đặt lại MFA',
      description: 'Chưa gửi link mật khẩu; link gửi trước bước này sẽ hết hiệu lực.',
    }
  } else if (emailDone && mfaDone && !passwordResetSent) {
    nextStep = {
      tone: 'border-blue-200 bg-blue-50 text-blue-900',
      icon: <KeyOutlined />,
      title: 'Tiếp theo: gửi link đặt lại mật khẩu',
      description: `Người dùng sẽ tự đặt mật khẩu mới qua ${account.email}.`,
    }
  } else if (passwordResetSent && !userCompleted) {
    nextStep = {
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: <ClockCircleOutlined />,
      title: 'Đã gửi link — đang chờ người dùng',
      description: 'Người dùng đặt mật khẩu, đăng nhập lại rồi cấu hình MFA/OAuth.',
    }
  } else if (userCompleted) {
    nextStep = {
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: <CheckCircleFilled />,
      title: 'Khôi phục danh tính đã hoàn tất',
      description: 'Email đã được xác minh và người dùng đã có mật khẩu mới.',
    }
  }

  const emailStatus = emailDone ? 'done' : 'active'
  const mfaStatus = !emailDone ? 'wait' : (mfaDone ? 'done' : 'active')
  const passwordStatus = passwordResetSent
    ? 'done'
    : (emailDone && mfaDone ? 'active' : 'wait')
  const finishStatus = userCompleted ? 'done' : (passwordResetSent ? 'active' : 'wait')

  return (
    <section
      aria-labelledby="identity-recovery-title"
      className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <SafetyCertificateOutlined className="text-lg" />
          </span>
          <div>
            <Typography.Title id="identity-recovery-title" level={4} className="!mb-1">
              Khôi phục quyền truy cập
            </Typography.Title>
            <Typography.Text type="secondary">
              Không có mật khẩu tạm — người dùng tự đặt mật khẩu mới qua email.
            </Typography.Text>
          </div>
        </div>
        <Tag color="blue">Quy trình bảo mật · 4 bước</Tag>
      </div>

      <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${nextStep.tone}`}>
        <span className="mt-0.5 text-base">{nextStep.icon}</span>
        <div>
          <div className="font-semibold">{nextStep.title}</div>
          <div className="mt-0.5 text-sm opacity-80">{nextStep.description}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RecoveryStepCard
          action={emailAction}
          description="Xác minh danh tính, nhập email mới và duyệt preview tác động."
          icon={<MailOutlined />}
          number={1}
          status={emailStatus}
          statusLabel={emailDone ? 'Đã xong' : 'Bắt đầu'}
          title="Đổi email"
        />
        <RecoveryStepCard
          action={mfaAction}
          description={hasMfa
            ? 'Xóa email MFA, ứng dụng xác thực và toàn bộ mã dự phòng.'
            : 'Tài khoản không có phương thức MFA cần xử lý.'}
          icon={<SafetyCertificateOutlined />}
          number={2}
          status={mfaStatus}
          statusLabel={!emailDone
            ? 'Chờ bước 1'
            : (mfaDone ? (hasMfa ? 'Đã xong' : 'Tự bỏ qua') : 'Cần làm')}
          title="Xử lý MFA"
        />
        <RecoveryStepCard
          action={passwordResetAction}
          description="Gửi sau thay đổi cuối cùng; mật khẩu mới do người dùng tự chọn."
          icon={<KeyOutlined />}
          number={3}
          status={passwordStatus}
          statusLabel={passwordResetSent
            ? 'Đã gửi'
            : (passwordStatus === 'active' ? 'Sẵn sàng' : 'Chưa mở')}
          title="Gửi link mật khẩu"
        />
        <RecoveryStepCard
          description="Người dùng đặt mật khẩu, đăng nhập và cấu hình lại MFA/OAuth."
          icon={<LockOutlined />}
          number={4}
          status={finishStatus}
          statusLabel={userCompleted
            ? 'Hoàn tất'
            : (passwordResetSent ? 'Đang chờ' : 'Chưa bắt đầu')}
          title="Người dùng hoàn tất"
        />
      </div>
    </section>
  )
}
