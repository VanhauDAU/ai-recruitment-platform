import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Spin } from 'antd'
import { Link } from 'react-router'
import {
  employerReadinessAction,
  employerReadinessBlockersFor,
} from '../model/employer-readiness'

const CAPABILITY_TITLES = {
  job_workspace: 'Workspace tuyển dụng chưa sẵn sàng',
  candidate_data: 'Dữ liệu ứng viên đang được bảo vệ',
}

export default function EmployerReadinessGateState({
  capability,
  checking = false,
  error = false,
  readiness,
  onRetry,
  compact = false,
}) {
  if (checking) {
    return (
      <div
        className={`flex items-center justify-center ${compact ? 'min-h-28' : 'min-h-64'}`}
        aria-label="Đang kiểm tra quyền truy cập"
      >
        <Spin size={compact ? 'default' : 'large'} />
      </div>
    )
  }

  const blockers = employerReadinessBlockersFor(readiness, capability)
  const primaryBlocker = blockers[0]
  const action = employerReadinessAction(primaryBlocker?.action)
  const retryButton = (
    <Button
      icon={<ReloadOutlined aria-hidden />}
      onClick={onRetry}
    >
      Kiểm tra lại
    </Button>
  )

  if (error) {
    return (
      <Alert
        className={compact ? '' : 'mx-auto mt-6 max-w-3xl'}
        showIcon
        type="error"
        title="Không thể kiểm tra quyền truy cập"
        description="Dữ liệu nhạy cảm và thao tác liên quan tạm thời bị khóa. Vui lòng thử lại."
        action={retryButton}
      />
    )
  }

  return (
    <Alert
      className={compact ? '' : 'mx-auto mt-6 max-w-3xl'}
      showIcon
      type="warning"
      title={CAPABILITY_TITLES[capability] || 'Quyền truy cập chưa sẵn sàng'}
      description={(
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5">
            {(blockers.length ? blockers : readiness?.blockers || []).map((blocker) => (
              <li key={`${blocker.code}-${blocker.action}`}>{blocker.message}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {primaryBlocker && (
              <Link to={action.to}>
                <Button type="primary">{action.label}</Button>
              </Link>
            )}
            {retryButton}
          </div>
        </div>
      )}
    />
  )
}
