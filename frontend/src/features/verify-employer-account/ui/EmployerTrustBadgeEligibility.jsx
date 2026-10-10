import { CheckCircleFilled, ClockCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import {
  employerProfileKeys,
  getEmployerProfile,
  resolveEmployerBadgeEligibility,
} from '@/entities/employer-profile'

function eligibleDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

export default function EmployerTrustBadgeEligibility({ profile: suppliedProfile, className = '' }) {
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
    enabled: !suppliedProfile,
  })
  const profile = suppliedProfile || profileQuery.data
  const eligibility = resolveEmployerBadgeEligibility(profile)

  if (!suppliedProfile && profileQuery.isLoading) {
    return <div className={className}><Skeleton active paragraph={{ rows: 5 }} /></div>
  }
  if (!suppliedProfile && profileQuery.isError) {
    return (
      <Alert
        className={className}
        type="error"
        showIcon
        title="Không tải được điều kiện nhận dấu tick"
        action={<button type="button" onClick={() => profileQuery.refetch()} className="font-semibold text-red-700 underline">Thử lại</button>}
      />
    )
  }
  if (!eligibility) return null

  const reached = eligibility.criteria.filter((item) => item.passed).length
  const total = eligibility.criteria.length
  const accountAgeDate = eligibleDate(eligibility.eligible_at)

  return (
    <section className={`min-w-0 rounded-xl border ${eligibility.verified ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/50'} p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${eligibility.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          <SafetyCertificateOutlined className="text-lg" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">Điều kiện nhận dấu tick trên tin tuyển dụng</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {eligibility.verified
              ? 'Tài khoản đang đáp ứng đầy đủ các tín hiệu uy tín công khai.'
              : `Đã đạt ${reached}/${total} điều kiện. Dấu tick khác với Cấp tài khoản và quota đăng tin.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {eligibility.criteria.map((criterion) => (
          <div
            key={criterion.key}
            className={`flex min-w-0 items-start gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm ${criterion.passed ? 'border-emerald-100 text-slate-700' : 'border-amber-200 text-amber-900'}`}
          >
            {criterion.passed
              ? <CheckCircleFilled className="mt-0.5 shrink-0 text-emerald-600" />
              : <ClockCircleOutlined className="mt-0.5 shrink-0 text-amber-600" />}
            <span className="min-w-0 break-words">{criterion.label}</span>
          </div>
        ))}
      </div>

      {!eligibility.verified && accountAgeDate && (
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Tài khoản dự kiến đạt điều kiện tuổi vào <strong>{accountAgeDate}</strong>
          {eligibility.minimum_account_months
            ? ` (ngưỡng hiện tại: ${eligibility.minimum_account_months} tháng).`
            : '.'}
        </p>
      )}
    </section>
  )
}
