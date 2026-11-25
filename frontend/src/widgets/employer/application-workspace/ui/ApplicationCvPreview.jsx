import { FileTextOutlined, MessageOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Segmented, Skeleton, Tooltip } from 'antd'
import { useState } from 'react'
import { applicationKeys, getApplicationCvFile } from '@/entities/application/application'
import { CvDocumentPreview, UploadedCvPreview } from '@/entities/cv/cv'
import { DownloadApplicationCvButton } from '@/features/employer/candidate/download-application-cv'
import { ShareApplicationReviewButton } from '@/features/employer/candidate/share-application-review'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { m } from '@/shared/config/i18n'
import { documentFromVersion } from '../model/application-workspace'
import ApplicationExtractedProfile from './ApplicationExtractedProfile'

const SOURCE_LABELS = {
  builder: m.employer_workspace_app_cv_source_builder(),
  uploaded: m.employer_workspace_app_cv_source_uploaded(),
  imported: m.employer_workspace_app_cv_source_imported(),
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
  const { containerRef: previewWrapRef, zoom: previewZoom } = usePreviewFitZoom(Boolean(previewDocument))
  const cvTitle = snapshot?.submitted_cv_title
    || selectedApplication?.submitted_cv_title
    || selectedApplication?.cv_title
    || m.employer_workspace_app_cv_fallback()

  return (
    <section
      aria-labelledby="application-cv-preview-title"
      data-testid="application-cv-preview"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-1 xl:col-span-6 xl:col-start-4 xl:h-full ${className}`}
    >
      <header className="aw-panel-head">
        <div className="min-w-0">
          <h2 id="application-cv-preview-title" className="aw-panel-title flex items-center gap-2">
            <FileTextOutlined className="text-slate-400" aria-hidden /> {m.employer_workspace_app_cv_preview()}
          </h2>
          {selectedPublicId && <p className="aw-panel-sub truncate">{cvTitle}</p>}
        </div>
        {profileAvailable && selectedPublicId ? (
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
        ) : (
          previewDocument && <span className="aw-count">{Math.round(previewZoom * 100)}%</span>
        )}
      </header>
      {selectedPublicId && (
        <div className="aw-actionbar" role="toolbar" aria-label={m.employer_workspace_app_cv_actions()}>
          <DownloadApplicationCvButton publicId={selectedPublicId} candidateName={candidateName} sourceFile={sourceFile} />
          <ShareApplicationReviewButton
            publicId={selectedPublicId}
            candidateName={candidateName}
            jobTitle={selectedApplication?.job_title || ''}
            disabledReason={sourceFile ? m.employer_workspace_app_share_disabled_uploaded() : ''}
          />
          <Tooltip title={m.employer_workspace_app_message_coming_soon()}>
            <span className="aw-actionbar__end">
              <Button size="small" icon={<MessageOutlined />} disabled>{m.employer_workspace_app_message()}</Button>
            </span>
          </Tooltip>
        </div>
      )}

      {showProfile && selectedPublicId && (
        <div className="min-h-96 flex-1 overflow-y-auto bg-white">
          <ApplicationExtractedProfile key={selectedPublicId} publicId={selectedPublicId} />
        </div>
      )}
      <div className={`min-h-96 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-3 sm:p-4${showProfile ? ' hidden' : ''}`}>
        {!selectedPublicId && (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={m.employer_workspace_app_select_cv_left()}
            />
          </div>
        )}
        {selectedPublicId && loading && (
          <div className="mx-auto min-h-96 max-w-3xl bg-white p-8 shadow-sm">
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
        {selectedPublicId && !loading && !error && sourceFile && (
          <UploadedCvPreview
            source={{ queryKey: applicationKeys.cvFile(selectedPublicId), load: () => getApplicationCvFile(selectedPublicId) }}
            title={cvTitle}
            className="aw-cv-file"
          />
        )}
        {selectedPublicId && !loading && !error && !sourceFile && !previewDocument && (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <Empty description={m.employer_workspace_app_no_cv_preview()} />
          </div>
        )}
        {selectedPublicId && !loading && !error && previewDocument && (
          <div ref={previewWrapRef} className="flex w-full justify-center">
            <div className="h-fit origin-top overflow-hidden rounded-sm bg-white shadow-xl shadow-slate-900/10" style={{ zoom: previewZoom }}>
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

      {(previewDocument || sourceFile) && (
        <footer className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-2.5 text-[11px] text-slate-500">
          <span>{sourceFile ? m.employer_workspace_app_cv_uploaded_file() : m.employer_workspace_app_cv_snapshot()}</span>
          <span className="aw-source">{sourceFile ? SOURCE_LABELS.uploaded : SOURCE_LABELS[snapshot.submitted_cv_source] || snapshot.submitted_cv_source || m.employer_workspace_app_cv_source_fallback()}</span>
        </footer>
      )}
    </section>
  )
}
