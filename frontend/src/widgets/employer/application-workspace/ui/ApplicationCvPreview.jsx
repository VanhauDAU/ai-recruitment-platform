import { ColumnWidthOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Segmented, Skeleton, Tooltip } from 'antd'
import { useState } from 'react'
import { applicationKeys, getApplicationCvFile } from '@/entities/application/application'
import { CvDocumentPreview, UploadedCvPreview } from '@/entities/cv/cv'
import { DownloadApplicationCvButton } from '@/features/employer/candidate/download-application-cv'
import { ShareApplicationReviewButton } from '@/features/employer/candidate/share-application-review'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { documentFromVersion } from '../model/application-workspace'
import useCvZoom, { CV_PAGE_WIDTH } from '../model/use-cv-zoom'
import ApplicationExtractedProfile from './ApplicationExtractedProfile'
import MessageCandidateButton from './MessageCandidateButton'

const SOURCE_LABELS = {
  builder: m.employer_workspace_app_cv_source_builder(),
  uploaded: m.employer_workspace_app_cv_source_uploaded(),
  imported: m.employer_workspace_app_cv_source_imported(),
}

function ZoomControls({ zoom }) {
  return (
    <div className="aw-zoom" role="group" aria-label={m.employer_workspace_app_zoom()} title={m.employer_workspace_app_zoom_hint()}>
      <Tooltip title={m.employer_workspace_app_zoom_out()}>
        <Button size="small" type="text" icon={<ZoomOutOutlined />} aria-label={m.employer_workspace_app_zoom_out()} disabled={!zoom.canZoomOut} onClick={zoom.zoomOut} />
      </Tooltip>
      <output className="aw-zoom__value" aria-live="polite">{Math.round(zoom.zoom * 100)}%</output>
      <Tooltip title={m.employer_workspace_app_zoom_in()}>
        <Button size="small" type="text" icon={<ZoomInOutlined />} aria-label={m.employer_workspace_app_zoom_in()} disabled={!zoom.canZoomIn} onClick={zoom.zoomIn} />
      </Tooltip>
      <Tooltip title={m.employer_workspace_app_zoom_fit()}>
        <Button size="small" type="text" icon={<ColumnWidthOutlined />} aria-label={m.employer_workspace_app_zoom_fit()} disabled={zoom.isFit} onClick={zoom.reset} />
      </Tooltip>
    </div>
  )
}

function Placeholder({ children }) {
  return <div className="aw-cv-placeholder">{children}</div>
}

export default function ApplicationCvPreview({
  candidateName,
  selectedApplication,
  snapshot,
  selectedPublicId,
  loading,
  error,
  onRetry,
  className = '',
}) {
  // 'cv': CV gốc; 'profile': hồ sơ trích xuất từ CV đó (chỉ khi tính năng phân tích AI bật).
  const [view, setView] = useState('cv')
  const profileAvailable = Boolean(selectedApplication?.ai_match_status)
  const showProfile = profileAvailable && view === 'profile'
  // CV tải lên được nộp bằng tệp gốc: hiện đúng tệp đó thay cho bản dựng từ nội dung.
  const sourceFile = Boolean(snapshot?.cv?.has_source_file)
  const previewDocument = sourceFile ? null : documentFromVersion(snapshot?.cv)
  const ready = Boolean(selectedPublicId && !loading && !error)
  const zoomable = ready && !showProfile && Boolean(previewDocument || sourceFile)
  const zoom = useCvZoom(zoomable, selectedPublicId)
  const cvTitle = snapshot?.submitted_cv_title
    || selectedApplication?.submitted_cv_title
    || selectedApplication?.cv_title
    || m.employer_workspace_app_cv_fallback()
  const sourceLabel = sourceFile
    ? SOURCE_LABELS.uploaded
    : SOURCE_LABELS[snapshot?.submitted_cv_source] || snapshot?.submitted_cv_source

  return (
    <section
      aria-label={m.employer_workspace_app_cv_preview()}
      data-testid="application-cv-preview"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-1 xl:col-span-6 xl:col-start-4 xl:h-full ${className}`}
    >
      <header className="aw-panel-head">
        <div className="min-w-0">
          <h2 className="aw-panel-title truncate">{selectedPublicId ? cvTitle : m.employer_workspace_app_cv_preview()}</h2>
          {ready && snapshot && (
            <p className="aw-panel-sub truncate">
              {[sourceLabel, sourceFile ? m.employer_workspace_app_cv_uploaded_file() : m.employer_workspace_app_cv_snapshot()].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {profileAvailable && selectedPublicId && (
          <Segmented
            size="small"
            aria-label={m.employer_workspace_app_mode_aria()}
            value={view}
            onChange={setView}
            options={[
              { value: 'cv', label: m.employer_workspace_app_mode_cv() },
              { value: 'profile', label: m.employer_workspace_app_mode_profile() },
            ]}
          />
        )}
      </header>
      {selectedPublicId && (
        <div className="aw-actionbar" role="toolbar" aria-label={m.employer_workspace_app_cv_actions()}>
          <MessageCandidateButton application={selectedApplication} />
          <DownloadApplicationCvButton publicId={selectedPublicId} candidateName={candidateName} sourceFile={sourceFile} />
          <ShareApplicationReviewButton
            publicId={selectedPublicId}
            candidateName={candidateName}
            jobTitle={selectedApplication?.job_title || ''}
            disabledReason={sourceFile ? m.employer_workspace_app_share_disabled_uploaded() : ''}
          />
          {zoomable && <ZoomControls zoom={zoom} />}
        </div>
      )}

      {showProfile && selectedPublicId && (
        <div className="min-h-96 flex-1 overflow-y-auto bg-white">
          <ApplicationExtractedProfile key={selectedPublicId} publicId={selectedPublicId} />
        </div>
      )}
      <div ref={zoom.containerRef} className={`aw-cv-viewport${showProfile ? ' hidden' : ''}`}>
        {!selectedPublicId && (
          <Placeholder>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_app_select_cv_left()} />
          </Placeholder>
        )}
        {selectedPublicId && loading && (
          <div className="aw-cv-page aw-cv-page--loading">
            <Skeleton active avatar paragraph={{ rows: 18 }} />
          </div>
        )}
        {selectedPublicId && !loading && error && (
          <Alert
            showIcon
            type="error"
            message={m.employer_workspace_app_cv_load_error()}
            description={getApiErrorMessage(error, m.employer_workspace_try_again_later())}
            action={<Button size="small" danger onClick={onRetry}>{m.employer_workspace_retry()}</Button>}
          />
        )}
        {ready && !sourceFile && !previewDocument && (
          <Placeholder>
            <Empty description={m.employer_workspace_app_no_cv_preview()} />
          </Placeholder>
        )}
        {ready && sourceFile && (
          // Trình xem PDF tự vừa bề rộng khung (`view=FitH`), nên đổi bề rộng là đổi mức thu phóng.
          <div className="aw-cv-stage aw-cv-stage--file">
            <UploadedCvPreview
              source={{ queryKey: applicationKeys.cvFile(selectedPublicId), load: () => getApplicationCvFile(selectedPublicId) }}
              title={cvTitle}
              className="aw-cv-file"
              style={{ width: CV_PAGE_WIDTH * zoom.zoom }}
            />
          </div>
        )}
        {ready && previewDocument && (
          <div className="aw-cv-stage">
            <div className="aw-cv-page" style={{ zoom: zoom.zoom }}>
              <CvDocumentPreview
                document={previewDocument}
                rendererKey={snapshot.cv.template_renderer_key}
                assets={snapshot.cv.assets}
                editorChrome={false}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
