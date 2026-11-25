import { m } from '@/shared/config/i18n'
import useApplicationWorkspace from '../model/use-application-workspace'
import ApplicationCandidateList from './ApplicationCandidateList'
import ApplicationCvPreview from './ApplicationCvPreview'
import ApplicationInspectorPanel from './ApplicationInspectorPanel'
import './application-workspace.css'

const MOBILE_TABS = [['cv', m.employer_workspace_app_cv_preview()], ['info', m.employer_workspace_app_inspector_title()]]

export default function EmployerApplicationWorkspace() {
  const workspace = useApplicationWorkspace()
  const { selectedApplication, selectedPublicId, snapshotQuery, historyQuery, mobilePanel } = workspace
  const candidateName = snapshotQuery.data?.contact_name
    || selectedApplication?.candidate_name
    || selectedApplication?.candidate_email
    || m.employer_workspace_app_candidate_fallback()

  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:h-[calc(100dvh-10rem)] xl:min-h-96 xl:grid-cols-12">
        <ApplicationCandidateList
          workspace={workspace}
          onKeywordSubmit={(value) => workspace.setListFilters({ q: value.trim() })}
        />
        {selectedPublicId && (
          <div role="tablist" aria-label={m.employer_workspace_app_mobile_tabs()} className="aw-tabs">
            {MOBILE_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mobilePanel === key}
                className="aw-tab"
                onClick={() => workspace.setMobilePanel(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <ApplicationCvPreview
          className={mobilePanel === 'cv' ? '' : 'max-md:hidden'}
          candidateName={candidateName}
          selectedApplication={selectedApplication}
          selectedPublicId={selectedPublicId}
          snapshot={snapshotQuery.data}
          loading={snapshotQuery.isLoading}
          error={snapshotQuery.error}
          onRetry={() => snapshotQuery.refetch()}
        />
        <ApplicationInspectorPanel
          className={mobilePanel === 'info' ? '' : 'max-md:hidden'}
          candidateName={candidateName}
          selectedApplication={selectedApplication}
          selectedPublicId={selectedPublicId}
          snapshot={snapshotQuery.data}
          history={historyQuery.data || []}
          historyLoading={historyQuery.isLoading}
          historyError={historyQuery.error}
          onRetryHistory={() => historyQuery.refetch()}
        />
      </div>
    </section>
  )
}
