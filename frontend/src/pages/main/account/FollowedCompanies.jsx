import { FollowedCompanyList } from '@/features/follow-company'

export default function FollowedCompanies() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-slate-900">Công ty đang theo dõi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Xem lại các công ty bạn quan tâm và chọn nhận email việc làm mới của từng công ty.
        </p>
      </div>
      <FollowedCompanyList />
    </section>
  )
}
