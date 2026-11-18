import { Space, Tag, Tooltip } from 'antd'

const STEP_META = {
  registration_completed: {
    label: 'Hồ sơ đăng ký',
    pageLabel: 'Hoàn thiện hồ sơ',
    path: '/tuyendung/app/account/complete-profile',
  },
  email_verified: {
    label: 'Xác minh email',
    pageLabel: 'Xác minh email',
    path: '/tuyendung/app/account/verify',
  },
  consulting_need_completed: {
    label: 'Nhu cầu tuyển dụng',
    pageLabel: 'Nhu cầu tư vấn',
    path: '/tuyendung/app/consulting-need',
  },
}

function missingKeys(onboarding) {
  if (Array.isArray(onboarding?.missing_steps)) return onboarding.missing_steps
  if (!onboarding?.steps) return []
  return Object.entries(onboarding.steps)
    .filter(([, completed]) => !completed)
    .map(([key]) => key)
}

export default function InitialOnboardingStatus({ onboarding, completed = false }) {
  const isCompleted = onboarding?.completed ?? completed
  const missing = missingKeys(onboarding)
  const missingLabels = missing.map((key) => STEP_META[key]?.label || key)
  const pageLabels = missing.map((key) => STEP_META[key]?.pageLabel).filter(Boolean)
  const pageHints = missing.map((key) => STEP_META[key]?.path).filter(Boolean)
  let detail = 'Chưa xác định bước còn thiếu'
  if (isCompleted) detail = 'Đã đủ hồ sơ, email và nhu cầu'
  else if (missingLabels.length) detail = `Thiếu: ${missingLabels.join(', ')}`

  return (
    <Space direction="vertical" size={2}>
      <Tag color={isCompleted ? 'green' : 'orange'}>
        {isCompleted ? 'Đã hoàn tất' : 'Chưa hoàn tất'}
      </Tag>
      <span className="text-xs text-slate-500">{detail}</span>
      {!isCompleted && pageLabels.length > 0 && (
        <Tooltip title={`Đường dẫn: ${pageHints.join('; ')}`}>
          <span className="cursor-help text-xs text-slate-500 underline decoration-dotted">
            Trang NTD: {pageLabels.join(', ')}
          </span>
        </Tooltip>
      )}
    </Space>
  )
}
