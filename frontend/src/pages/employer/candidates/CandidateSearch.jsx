import { useSearchParams } from 'react-router'
import { CandidateSearchWorkspace } from '@/features/employer/candidate/search-candidates'
import { m } from '@/shared/config/i18n'

export default function CandidateSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jobPublicId = searchParams.get('job') || ''

  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{m.employer_workspace_title_candidate_search()}</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">{m.employer_workspace_search_page_intro()}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <CandidateSearchWorkspace
          jobPublicId={jobPublicId}
          onJobChange={(value) => setSearchParams(value ? { job: value } : {}, { replace: true })}
        />
      </div>
    </section>
  )
}
