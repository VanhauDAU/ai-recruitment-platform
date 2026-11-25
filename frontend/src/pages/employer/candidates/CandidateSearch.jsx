import { useSearchParams } from 'react-router'
import { CandidateSearchWorkspace } from '@/features/employer/candidate/search-candidates'
import { m } from '@/shared/config/i18n'

export default function CandidateSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jobPublicId = searchParams.get('job') || ''

  return (
    <section className="space-y-3 pb-5 pt-3">
      <header>
        <h1 className="text-lg font-bold text-slate-900">{m.employer_workspace_title_candidate_search()}</h1>
        <p className="mt-0.5 max-w-3xl text-xs leading-5 text-slate-500">{m.employer_workspace_search_page_intro()}</p>
      </header>
      <CandidateSearchWorkspace
        jobPublicId={jobPublicId}
        onJobChange={(value) => setSearchParams(value ? { job: value } : {}, { replace: true })}
      />
    </section>
  )
}
