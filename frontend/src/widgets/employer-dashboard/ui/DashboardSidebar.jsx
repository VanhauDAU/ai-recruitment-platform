import {
  ArrowRightOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  FormOutlined,
  InboxOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import {
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_RECRUITMENT_DEMAND_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const numberFormatter = new Intl.NumberFormat('vi-VN')

function PriorityAction({ icon, label, detail, tone, to }) {
  const Icon = icon
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-slate-100 !bg-slate-50/70 px-3 py-2.5 transition hover:border-emerald-100 hover:!bg-emerald-50/70">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon /></span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs text-slate-800">{label}</strong>
        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{detail}</span>
      </span>
      <ArrowRightOutlined className="text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
    </Link>
  )
}

export default function DashboardSidebar({
  account = {},
  recruitmentNeed,
  summary = {},
  candidateActionTarget,
  jobWorkspaceReady,
}) {
  const companyVerified = account.company_verification_status === 'verified'

  return (
    <aside className="space-y-4">
      <section className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="priority-actions-title">
        <div className="flex items-center justify-between px-2 pb-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-600">Ưu tiên hôm nay</p>
            <h2 id="priority-actions-title" className="mt-1 text-base font-black text-slate-900">Việc cần xử lý</h2>
          </div>
          <ClockCircleOutlined className="text-lg text-slate-300" />
        </div>
        <div className="mt-2 space-y-2">
          <PriorityAction
            icon={InboxOutlined}
            label={`${numberFormatter.format(summary.applications_new || 0)} hồ sơ mới`}
            detail="Xem và cập nhật trạng thái"
            tone="bg-blue-50 text-blue-600"
            to={candidateActionTarget}
          />
          <PriorityAction
            icon={FileDoneOutlined}
            label={`${numberFormatter.format(summary.jobs_pending || 0)} tin đang chờ duyệt`}
            detail={`${numberFormatter.format(summary.jobs_draft || 0)} bản nháp chưa hoàn tất`}
            tone="bg-amber-50 text-amber-600"
            to={jobWorkspaceReady ? employerAppPath('/jobs') : EMPLOYER_VERIFY_URL}
          />
          <PriorityAction
            icon={companyVerified ? CheckCircleFilled : FormOutlined}
            label={companyVerified ? 'Doanh nghiệp đã xác thực' : 'Hoàn thiện hồ sơ xác thực'}
            detail={companyVerified ? 'Thông tin pháp lý đã được duyệt' : 'Mở thêm quyền cho workspace'}
            tone={companyVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}
            to={companyVerified ? EMPLOYER_COMPANY_SETTINGS_URL : EMPLOYER_VERIFY_URL}
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="recruitment-need-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">Kế hoạch tuyển dụng</p>
            <h2 id="recruitment-need-title" className="mt-1 font-black text-slate-900">Nhu cầu ưu tiên</h2>
          </div>
          <Link to={EMPLOYER_RECRUITMENT_DEMAND_URL} aria-label="Cập nhật nhu cầu tuyển dụng" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 !bg-slate-100 !text-slate-500 transition hover:border-emerald-200 hover:!bg-emerald-50 hover:!text-emerald-600"><SettingOutlined /></Link>
        </div>
        {recruitmentNeed ? (
          <div className="mt-4">
            <strong className="block text-sm leading-6 text-slate-900">{recruitmentNeed.position_category_name}</strong>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NeedStat icon={TeamOutlined} label="Số lượng" value={`${recruitmentNeed.headcount} người`} />
              <NeedStat icon={CalendarOutlined} label="Thời hạn" value={recruitmentNeed.is_continuous ? 'Liên tục' : recruitmentNeed.target_date ? dateFormatter.format(new Date(`${recruitmentNeed.target_date}T00:00:00`)) : 'Chưa đặt'} />
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Cấp bậc <strong className="float-right text-slate-700">{recruitmentNeed.position_level_label}</strong></div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center">
            <p className="text-xs leading-5 text-slate-500">Chưa có nhu cầu tuyển dụng ưu tiên.</p>
            <Link to={EMPLOYER_RECRUITMENT_DEMAND_URL} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-600 !bg-emerald-600 px-3 text-xs font-bold !text-white shadow-sm transition hover:border-emerald-700 hover:!bg-emerald-700">Thêm nhu cầu <ArrowRightOutlined /></Link>
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="company-summary-title">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BankOutlined /></span>
          <div className="min-w-0 flex-1">
            <h2 id="company-summary-title" className="truncate text-sm font-black text-slate-900">{account.company_name || 'Doanh nghiệp của bạn'}</h2>
            <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${companyVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {companyVerified && <CheckCircleFilled />}{companyVerified ? 'Đã xác thực pháp lý' : 'Chưa xác thực pháp lý'}
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-[11px] text-slate-500">
          {account.work_location_name && <p className="flex items-center gap-2"><EnvironmentOutlined className="text-slate-400" /> <span className="truncate">{account.work_location_name}</span></p>}
          {account.company_size && <p className="flex items-center gap-2"><TeamOutlined className="text-slate-400" /> {account.company_size} nhân viên</p>}
          <p className="flex items-center gap-2"><BankOutlined className="text-slate-400" /> Mã NTD: {account.recruiter_public_id || '—'}</p>
        </div>
      </section>
    </aside>
  )
}

function NeedStat({ icon, label, value }) {
  const Icon = icon
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><Icon /> {label}</span>
      <strong className="mt-1.5 block truncate text-xs text-slate-700">{value}</strong>
    </div>
  )
}
