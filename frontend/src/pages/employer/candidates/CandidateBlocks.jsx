import { CandidateBlockList } from '@/features/employer/candidate/manage-candidate-blocks'
import { m } from '@/shared/config/i18n'

export default function CandidateBlocks() {
  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{m.employer_workspace_title_candidate_blocks()}</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {m.employer_workspace_blocklist_page_intro()}
        </p>
      </div>
      <CandidateBlockList />
    </section>
  )
}
