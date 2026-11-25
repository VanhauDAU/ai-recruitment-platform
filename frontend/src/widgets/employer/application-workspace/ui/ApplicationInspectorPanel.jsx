import { HistoryOutlined, LockOutlined } from '@ant-design/icons'
import { Alert, Empty, Skeleton } from 'antd'
import { Link } from 'react-router'
import { ApplicationDecisionBar } from '@/features/employer/candidate/application-status-decision'
import { BlockCandidateButton } from '@/features/employer/candidate/block-candidate'
import { SaveToTalentPoolButton } from '@/features/employer/candidate/save-to-talent-pool'
import { ApplicationMatchCard } from '@/features/employer/candidate/view-application-match'
import { employerAppPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'
import { formatApplicationDate, initialsOf, pendingNoticeOf } from '../model/application-workspace'
import ApplicationAssessmentSection from './ApplicationAssessmentSection'
import ApplicationHistoryTimeline from './ApplicationHistoryTimeline'
import ApplicationReviewsSection from './ApplicationReviewsSection'
import ApplicationStatusBadge from './ApplicationStatusBadge'
import PreviousSubmissions from './PreviousSubmissions'

const SOURCE_LABELS = {
  applied: m.employer_workspace_app_source_applied(),
  recommended: m.employer_workspace_app_source_recommended(),
  invited: m.employer_workspace_app_source_invited(),
}

/** Một dòng nhãn – giá trị; nhãn cột trái cố định để mắt dò theo cột giá trị. */
function InfoRow({ label, children }) {
  return (
    <div className="aw-info">
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

function TextBlock({ label, children }) {
  return (
    <div className="aw-info aw-info--block">
      <dt>{label}</dt>
      <dd className="aw-info__text">{children}</dd>
    </div>
  )
}

/** Blocklist state, or the mass-apply signal that suggests blocking. */
function CandidateTrust({ application, candidateName }) {
  if (application.candidate_blocked) {
    return (
      <Alert
        showIcon
        type="error"
        title={m.employer_workspace_app_blocked_title()}
        action={<Link to={employerAppPath('/candidate-blocks')} className="text-xs font-semibold">{m.employer_workspace_app_manage()}</Link>}
      />
    )
  }
  const signal = application.mass_apply_signal
  if (signal) {
    return (
      <Alert
        showIcon
        type="warning"
        title={m.employer_workspace_app_mass_apply_title()}
        description={m.employer_workspace_app_mass_apply_description({ jobs: signal.jobs, days: signal.window_days })}
        action={<BlockCandidateButton application={application} candidateName={candidateName} />}
      />
    )
  }
  return (
    <div className="aw-secondary-actions">
      <SaveToTalentPoolButton application={application} candidateName={candidateName} block />
      <BlockCandidateButton application={application} candidateName={candidateName} block label={m.employer_workspace_app_block()} />
    </div>
  )
}

export default function ApplicationInspectorPanel({
  candidateName,
  selectedApplication,
  snapshot,
  selectedPublicId,
  history,
  historyLoading,
  historyError,
  onRetryHistory,
  className = '',
}) {
  const candidateEmail = snapshot?.contact_email || selectedApplication?.candidate_email
  const restricted = Boolean(selectedApplication?.candidate_account_restricted)

  return (
    <aside
      aria-labelledby="application-inspector-title"
      data-testid="application-inspector"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-2 xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:h-full ${className}`}
    >
      <header className="aw-panel-head">
        <h2 id="application-inspector-title" className="aw-panel-title">{m.employer_workspace_app_inspector_title()}</h2>
        {selectedApplication && <ApplicationStatusBadge status={selectedApplication.status} />}
      </header>

      {!selectedPublicId || !selectedApplication ? (
        <div className="flex min-h-[360px] flex-1 items-center justify-center p-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_app_select_cv()} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <section className="aw-hero space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="aw-avatar">{initialsOf(candidateName)}</span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-900">{candidateName}</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">{candidateEmail || m.employer_workspace_app_no_email()}</p>
              </div>
              {restricted && <LockOutlined title={m.employer_workspace_app_account_restricted_short()} className="shrink-0 text-amber-500" />}
            </div>
            {restricted && (
              <Alert
                showIcon
                type="warning"
                message={m.employer_workspace_app_account_restricted_title()}
                description={m.employer_workspace_app_account_restricted_description()}
              />
            )}
            <ApplicationDecisionBar
              application={selectedApplication}
              candidateName={candidateName}
              pendingNotice={pendingNoticeOf(history)}
            />
            <CandidateTrust application={selectedApplication} candidateName={candidateName} />
          </section>

          <ApplicationMatchCard application={selectedApplication} />

          <section className="aw-section">
            <h3 className="aw-section__title">{m.employer_workspace_app_contact()}</h3>
            {!snapshot && <Skeleton active paragraph={{ rows: 3 }} />}
            {snapshot && (
              <dl className="aw-info-list">
                <InfoRow label="Email">
                  {candidateEmail ? <a className="text-slate-700 underline decoration-slate-300" href={`mailto:${candidateEmail}`}>{candidateEmail}</a> : '—'}
                </InfoRow>
                <InfoRow label={m.employer_workspace_app_phone()}>
                  {snapshot.contact_phone ? <a className="text-slate-700 underline decoration-slate-300" href={`tel:${snapshot.contact_phone}`}>{snapshot.contact_phone}</a> : '—'}
                </InfoRow>
                <InfoRow label={m.employer_workspace_app_preferred_location()}>
                  {snapshot.preferred_location_names?.join(', ') || m.employer_workspace_app_no_requirement()}
                </InfoRow>
              </dl>
            )}
          </section>

          <section className="aw-section">
            <h3 className="aw-section__title">{m.employer_workspace_app_application_info()}</h3>
            <dl className="aw-info-list">
              <InfoRow label={m.employer_workspace_app_job()}>
                {selectedApplication.job_title}
              </InfoRow>
              <InfoRow label={m.employer_workspace_app_applied_date()}>
                {formatApplicationDate(selectedApplication.applied_at, true)}
                {` · ${m.employer_workspace_app_submission({ number: selectedApplication.submission_number || 1 })}`}
              </InfoRow>
              {selectedApplication.last_reminded_at && (
                <InfoRow label={m.employer_workspace_app_awaiting_response()}>
                  {m.employer_workspace_app_reminded({ date: formatApplicationDate(selectedApplication.last_reminded_at, true) })}
                </InfoRow>
              )}
              <InfoRow label={m.employer_workspace_app_source()}>
                {selectedApplication.campaign_channel_label
                  ? m.employer_workspace_app_campaign_channel({ channel: selectedApplication.campaign_channel_label })
                  : SOURCE_LABELS[selectedApplication.source] || selectedApplication.source || m.employer_workspace_app_source_direct()}
              </InfoRow>
              <InfoRow label={m.employer_workspace_app_ai_analysis()}>
                {snapshot?.allow_ai_analysis ? m.employer_workspace_app_ai_consented() : m.employer_workspace_app_ai_no_consent()}
              </InfoRow>
              {selectedApplication.cover_letter && <TextBlock label={m.employer_workspace_app_cover_letter()}>{selectedApplication.cover_letter}</TextBlock>}
              {selectedApplication.candidate_note && <TextBlock label={m.employer_workspace_app_candidate_note()}>{selectedApplication.candidate_note}</TextBlock>}
            </dl>
          </section>

          <PreviousSubmissions application={selectedApplication} />

          <ApplicationReviewsSection publicId={selectedApplication.public_id} />

          <ApplicationAssessmentSection key={selectedApplication.public_id} application={selectedApplication} />

          <section className="aw-section">
            <h3 className="aw-section__title">
              <HistoryOutlined className="text-[var(--brand-primary)]" aria-hidden /> {m.employer_workspace_app_history()}
            </h3>
            <ApplicationHistoryTimeline
              items={history}
              loading={historyLoading}
              error={historyError}
              onRetry={onRetryHistory}
            />
          </section>
        </div>
      )}
    </aside>
  )
}
