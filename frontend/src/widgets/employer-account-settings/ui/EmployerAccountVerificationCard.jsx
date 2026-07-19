import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerProfile } from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { getEmployerAccountVerificationLevel } from '@/features/verify-employer-account'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
} from '@/shared/config/portals'

const STEPS = [
  { key: 'phone_verified', label: 'Xác thực số điện thoại', to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', label: 'Cập nhật thông tin công ty', to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_approved', label: 'Xác thực Giấy đăng ký doanh nghiệp', to: EMPLOYER_BUSINESS_LICENSE_URL },
]

export default function EmployerAccountVerificationCard() {
  const { user } = useSession()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })

  if (profileQuery.isLoading) {
    return (
      <div className="mb-5 rounded-sm border border-slate-200 bg-white p-5 sm:p-6">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  }

  const verification = profileQuery.data?.onboarding || {}
  const level = getEmployerAccountVerificationLevel(verification, user)
  const doneCount = STEPS.filter((step) => verification[step.key]).length
  const percent = Math.round((doneCount / STEPS.length) * 100)
  const nextLevel = Math.min(level.level + 1, level.total)

  return (
    <div className="mb-5 rounded-sm border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-800">
        Tài khoản xác thực: <span className="text-emerald-600">Cấp {level.level}/{level.total}</span>
      </h2>

      {level.level < level.total && (
        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl">🌟</span>
          <p className="text-sm leading-6 text-slate-600">
            Nâng cấp tài khoản lên <strong className="text-slate-800">cấp {nextLevel}/{level.total}</strong> để nhận{' '}
            <strong className="text-emerald-600">100 lượt xem CV ứng viên từ công cụ tìm kiếm CV</strong>.
          </p>
        </div>
      )}

      <p className="mt-4 text-sm text-slate-500">Vui lòng thực hiện các bước xác thực dưới đây:</p>

      <div className="mt-5 flex items-center justify-between text-sm">
        <strong className="text-base text-slate-800">Xác thực thông tin</strong>
        <span className="text-slate-500">Hoàn thành <strong className="text-emerald-600">{percent}%</strong></span>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {STEPS.map((step) => {
          const completed = Boolean(verification[step.key])
          return (
            <Link
              key={step.key}
              to={step.to}
              className="flex items-center gap-3 py-4 text-sm font-semibold !text-slate-800 transition hover:!text-emerald-700"
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${completed ? 'text-emerald-600' : 'border border-slate-400 text-transparent'}`}>
                {completed && <CheckCircleFilled />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ArrowRightOutlined /></span>
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={EMPLOYER_VERIFY_URL}
          className="rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium !text-emerald-600 transition hover:bg-emerald-50"
        >
          Tìm hiểu thêm
        </Link>
      </div>
    </div>
  )
}
