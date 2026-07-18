import { BarChartOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { RecruitmentNeedForm } from '@/features/capture-employer-recruitment-need'
import { useSession } from '@/entities/session'

function HiringConversationVisual() {
  return (
    <aside className="relative hidden min-h-[760px] overflow-hidden bg-[linear-gradient(155deg,#65d080_0%,#169968_48%,#063d38_100%)] lg:block">
      <span className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[34px] border-white/10" />
      <span className="absolute left-16 top-24 h-24 w-64 rotate-[-18deg] rounded-full bg-white/10" />
      <div className="absolute inset-x-0 bottom-0 h-96 bg-[linear-gradient(transparent,rgba(2,44,38,.55))]" />
      <div className="absolute inset-x-12 bottom-24 rounded-3xl border border-white/15 bg-black/15 p-7 text-white shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between"><strong className="text-lg">Kế hoạch tuyển dụng</strong><BarChartOutlined className="text-2xl text-emerald-200" /></div>
        <div className="mt-6 flex items-end justify-center gap-8">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-800 shadow-lg"><UserOutlined /></span>
          <span className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl text-emerald-700 shadow-lg"><TeamOutlined /></span>
        </div>
        <p className="mt-4 text-center text-sm leading-6 text-white/75">Hiểu đúng nhu cầu để gợi ý giải pháp và nguồn ứng viên phù hợp hơn.</p>
      </div>
    </aside>
  )
}

export default function EmployerConsultingNeedPanel({ onCompleted }) {
  const { user } = useSession()
  return (
    <div className="mx-auto grid max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1.65fr)_minmax(360px,1fr)]">
      <section className="p-6 sm:p-9 lg:p-12">
        <h1 className="text-2xl font-black text-slate-900">Xin chào, <span className="text-emerald-600">{user?.full_name || user?.email}</span></h1>
        <p className="mt-1 text-sm text-slate-500">Hãy cung cấp thông tin về đợt tuyển dụng sắp tới để chúng tôi hỗ trợ bạn tốt hơn</p>
        <h2 className="mt-8 text-xl font-black text-slate-900">Nhu cầu tuyển dụng</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Đây là thông tin về vị trí bạn đang cần ưu tiên tuyển nhất hiện tại. Bạn có thể cập nhật nhu cầu này sau trong trang quản lý.</p>
        <RecruitmentNeedForm onCompleted={onCompleted} />
      </section>
      <HiringConversationVisual />
    </div>
  )
}
