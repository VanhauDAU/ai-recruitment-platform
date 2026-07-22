import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import {
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'

const ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  {
    key: 'phone_verified',
    label: 'Xác thực số điện thoại',
    to: EMPLOYER_PHONE_VERIFY_URL,
  },
  {
    key: 'company_linked',
    label: 'Cập nhật thông tin công ty',
    to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`,
  },
  {
    key: 'business_doc_approved',
    label: 'Xác thực Giấy đăng ký doanh nghiệp',
    to: employerAppPath('/account/settings/gpkd'),
  },
]

export default function EmployerAccountVerificationPopover({ verification, level }) {
  return (
    <div className="w-[min(330px,calc(100vw-48px))] p-1 sm:w-[344px]" aria-label="Chi tiết cấp xác thực tài khoản">
      <div className="flex items-center gap-2 text-base font-bold text-slate-800">
        <span>Tài khoản xác thực:</span>
        <strong className="text-emerald-600">
          Cấp {level.level}/{level.total}
        </strong>
      </div>
      <span className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xl">
        🌟
      </span>
      <p className="mt-4 text-sm text-slate-500">Vui lòng thực hiện các bước xác thực dưới đây:</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <strong className="text-base text-slate-800">Xác thực thông tin</strong>
        <span className="text-slate-500">
          Hoàn thành <strong className="text-emerald-600">{level.percent}%</strong>
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${level.percent}%` }}
        />
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {ACCOUNT_VERIFICATION_LEVEL_STEPS.map((step) => {
          const completed = Boolean(verification[step.key])
          return (
            <Link
              key={step.key}
              to={step.to}
              className="flex items-center gap-3 py-4 text-sm font-semibold text-slate-700 transition hover:text-emerald-700"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${completed ? 'text-emerald-600' : 'border border-slate-400 text-transparent'}`}
              >
                {completed && <CheckCircleFilled />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <ArrowRightOutlined />
              </span>
            </Link>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={EMPLOYER_VERIFY_URL}
          className="rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50"
        >
          Tìm hiểu thêm
        </Link>
      </div>
    </div>
  )
}
