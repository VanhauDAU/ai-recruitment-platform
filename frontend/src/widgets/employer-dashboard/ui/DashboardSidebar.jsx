import { ArrowRightOutlined, BankOutlined, CalendarOutlined, EnvironmentOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons'
import { Progress, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerVerificationProgress } from '@/features/verify-employer-account'
import { employerAppPath } from '@/shared/config/portals'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function DashboardSidebar({ account = {}, recruitmentNeed }) {
  const progress = getEmployerVerificationProgress(account.verification || {})
  const companyVerified = account.company_verification_status === 'verified'

  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-extrabold text-slate-900">Độ tin cậy tài khoản</h2><SafetyCertificateOutlined className="text-xl text-emerald-600" /></div>
        <div className="mt-5 flex items-center gap-4"><Progress type="circle" percent={progress.percent} size={70} strokeColor="#00b14f" /><div><strong className="text-sm text-slate-900">{progress.completed}/{progress.total} bước hoàn tất</strong><p className="mt-1 text-xs leading-5 text-slate-500">Tăng uy tín khi tiếp cận ứng viên.</p></div></div>
        <Link to={employerAppPath('/employer-verify')} className="mt-5 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100">
          {progress.percent === 100 ? 'Xem trạng thái xác thực' : 'Tiếp tục xác thực'} <ArrowRightOutlined />
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-extrabold text-slate-900">Nhu cầu ưu tiên</h2><TeamOutlined className="text-lg text-emerald-600" /></div>
        {recruitmentNeed ? (
          <div className="mt-4 space-y-3 text-sm">
            <strong className="block leading-6 text-slate-900">{recruitmentNeed.position_category_name}</strong>
            <div className="flex items-center justify-between gap-3 text-slate-500"><span>Cấp bậc</span><span className="font-semibold text-slate-700">{recruitmentNeed.position_level_label}</span></div>
            <div className="flex items-center justify-between gap-3 text-slate-500"><span>Số lượng</span><span className="font-semibold text-slate-700">{recruitmentNeed.headcount} người</span></div>
            <div className="flex items-center justify-between gap-3 text-slate-500"><span>Thời hạn</span><span className="font-semibold text-slate-700">{recruitmentNeed.is_continuous ? 'Tuyển liên tục' : dateFormatter.format(new Date(`${recruitmentNeed.target_date}T00:00:00`))}</span></div>
          </div>
        ) : <p className="mt-4 text-sm leading-6 text-slate-500">Chưa có dữ liệu nhu cầu tuyển dụng.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BankOutlined /></span><div className="min-w-0"><h2 className="truncate font-extrabold text-slate-900">{account.company_name || 'Doanh nghiệp của bạn'}</h2><div className="mt-2 flex flex-wrap gap-2"><Tag color={companyVerified ? 'green' : 'gold'}>{companyVerified ? 'Đã xác thực' : 'Chưa xác thực pháp lý'}</Tag>{account.company_size && <Tag>{account.company_size} nhân viên</Tag>}</div></div></div>
        {account.work_location_name && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><EnvironmentOutlined /> {account.work_location_name}</p>}
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><CalendarOutlined /> Mã NTD: {account.recruiter_public_id || '—'}</p>
      </section>

      <div className="group block overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#17324a,#0b6654)] p-5 text-white shadow-sm">
        <span className="text-xs font-bold uppercase tracking-[.16em] text-emerald-200">Giải pháp tuyển dụng</span>
        <strong className="mt-3 block text-lg leading-6">Khám phá gói dịch vụ phù hợp với kế hoạch tuyển dụng</strong>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100">Sắp mở trong workspace</span>
      </div>
    </aside>
  )
}
