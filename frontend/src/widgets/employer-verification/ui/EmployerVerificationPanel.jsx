import { BarChartOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getEmployerProfile, getEmployerRecruitmentNeed } from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { EmployerVerificationChecklist } from '@/features/verify-employer-account'
import { employerAppPath } from '@/shared/config/portals'

function VerificationStory({ need, companyName }) {
  return (
    <aside className="relative overflow-hidden bg-[linear-gradient(155deg,#087f5b_0%,#006b50_54%,#063f3a_100%)] p-6 text-white sm:p-8 lg:min-h-[720px] lg:p-10">
      <span className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[32px] border-white/10" />
      <span className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-emerald-400/10" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-emerald-100">
          <SafetyCertificateOutlined /> Tài khoản tin cậy
        </span>
        <p className="mt-8 text-sm text-white/70">Bạn đang ưu tiên tuyển dụng</p>
        <h2 className="mt-2 max-w-md text-2xl font-black leading-tight sm:text-3xl">
          {need?.position_category_name || 'Nhân sự phù hợp cho doanh nghiệp'}
        </h2>
        <p className="mt-3 text-sm text-emerald-100/80">{companyName || 'Hồ sơ doanh nghiệp của bạn'}</p>

        <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3"><TeamOutlined className="text-2xl text-emerald-200" /><strong className="text-lg">{need?.headcount || 1} vị trí cần tuyển</strong></div>
            <p className="mt-2 text-sm leading-6 text-white/70">Thông tin đã khai báo được dùng để cá nhân hóa workspace và gợi ý nguồn ứng viên.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3"><BarChartOutlined className="text-2xl text-emerald-200" /><strong className="text-lg">Bắt đầu đúng nền tảng</strong></div>
            <p className="mt-2 text-sm leading-6 text-white/70">Xác thực giúp ứng viên nhận diện nhà tuyển dụng uy tín và bảo vệ dữ liệu tuyển dụng.</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function EmployerVerificationPanel() {
  const navigate = useNavigate()
  const { user } = useSession()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const needQuery = useQuery({ queryKey: ['employer', 'recruitment-need'], queryFn: getEmployerRecruitmentNeed })

  if (profileQuery.isLoading) {
    return <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8"><Skeleton active paragraph={{ rows: 14 }} /></div>
  }
  if (profileQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="Không thể tải trạng thái xác thực tài khoản."
        action={<Button size="small" onClick={() => profileQuery.refetch()}>Thử lại</Button>}
        className="mx-auto max-w-4xl"
      />
    )
  }

  const profile = profileQuery.data || {}
  return (
    <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,.10)] lg:grid-cols-[minmax(360px,.9fr)_minmax(520px,1.1fr)]">
      <VerificationStory
        need={needQuery.data}
        companyName={profile.onboarding?.company_linked ? profile.company?.company_name : ''}
      />
      <section className="p-6 sm:p-9 lg:p-12">
        <h1 className="text-2xl font-black text-slate-900">Xin chào, <span className="text-emerald-600">{user?.full_name || user?.email}</span></h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Bạn có thể hoàn thiện các bước bảo mật ngay bây giờ hoặc tiếp tục vào dashboard và quay lại sau.</p>
        <div className="mt-8">
          <EmployerVerificationChecklist
            profile={profile}
            onContinue={() => navigate(employerAppPath('/dashboard'), { replace: true })}
          />
        </div>
      </section>
    </div>
  )
}
