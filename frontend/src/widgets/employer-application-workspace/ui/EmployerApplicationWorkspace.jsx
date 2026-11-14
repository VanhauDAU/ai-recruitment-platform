import useApplicationWorkspace, { PAGE_SIZE } from '../model/use-application-workspace'
import ApplicationCandidateList from './ApplicationCandidateList'
import ApplicationCvPreview from './ApplicationCvPreview'
import ApplicationInspectorPanel from './ApplicationInspectorPanel'
import './application-workspace.css'

const MOBILE_TABS = [['cv', 'Xem trước CV'], ['info', 'Xử lý hồ sơ']]

export default function EmployerApplicationWorkspace() {
  const workspace = useApplicationWorkspace()
  const { selectedApplication, selectedPublicId, snapshotQuery, historyQuery, mobilePanel } = workspace
  const candidateName = snapshotQuery.data?.contact_name
    || selectedApplication?.candidate_name
    || selectedApplication?.candidate_email
    || 'Ứng viên'

  return (
    <section className="space-y-4 pb-5 pt-3">
      <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:h-[calc(100dvh-10rem)] xl:min-h-96 xl:grid-cols-12">
        <ApplicationCandidateList
          groups={workspace.groups}
          applicationCount={workspace.applicationCount}
          selectedPublicId={selectedPublicId}
          keyword={workspace.keyword}
          status={workspace.statusFilter}
          page={workspace.page}
          pageSize={PAGE_SIZE}
          loading={workspace.listQuery.isLoading}
          error={workspace.listQuery.error}
          onKeywordChange={workspace.setKeyword}
          onKeywordSubmit={(value) => workspace.setListFilter('q', value.trim())}
          onStatusChange={(value) => workspace.setListFilter('status', value)}
          onPageChange={workspace.changePage}
          onRetry={() => workspace.listQuery.refetch()}
          onSelect={workspace.selectApplication}
        />
        {selectedPublicId && (
          <div role="tablist" aria-label="Nội dung hồ sơ trên thiết bị di động" className="aw-tabs">
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
