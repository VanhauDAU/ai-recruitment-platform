import { CandidateBlockList } from '@/features/manage-candidate-blocks'

export default function CandidateBlocks() {
  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Danh sách đen</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Ứng viên trong danh sách không thể nộp hồ sơ vào các tin của bạn và không được thông báo việc bị chặn.
        </p>
      </div>
      <CandidateBlockList />
    </section>
  )
}
