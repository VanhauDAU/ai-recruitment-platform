import { useSearchParams } from 'react-router'
import { TalentPoolList, TalentSuggestions } from '@/features/employer/candidate/manage-talent-pool'
import { m } from '@/shared/config/i18n'

export default function TalentPool() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jobPublicId = searchParams.get('job') || ''

  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{m.employer_workspace_title_talent_pool()}</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {m.employer_workspace_pool_page_intro()}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><TalentPoolList /></div>
        <div className="lg:col-span-5">
          <TalentSuggestions
            jobPublicId={jobPublicId}
            onJobChange={(value) => setSearchParams(value ? { job: value } : {}, { replace: true })}
          />
        </div>
      </div>
    </section>
  )
}
