import { FileTextOutlined, MessageOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Skeleton, Tooltip } from 'antd'
import { applicationKeys, getApplicationCvFile } from '@/entities/application'
import { CvDocumentPreview, UploadedCvPreview } from '@/entities/cv'
import { DownloadApplicationCvButton } from '@/features/download-application-cv'
import { ShareApplicationReviewButton } from '@/features/share-application-review'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { documentFromVersion } from '../model/application-workspace'

const SOURCE_LABELS = {
  builder: 'Tạo trên hệ thống',
  uploaded: 'CV tải lên',
  imported: 'CV nhập vào',
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
  // CV tải lên được nộp bằng tệp gốc: hiện đúng tệp đó thay cho bản dựng từ nội dung.
  const sourceFile = Boolean(snapshot?.cv?.has_source_file)
  const previewDocument = sourceFile ? null : documentFromVersion(snapshot?.cv)
  const { containerRef: previewWrapRef, zoom: previewZoom } = usePreviewFitZoom(Boolean(previewDocument))
  const cvTitle = snapshot?.submitted_cv_title
    || selectedApplication?.submitted_cv_title
    || selectedApplication?.cv_title
    || 'CV ứng viên'

  return (
    <section
      aria-labelledby="application-cv-preview-title"
      data-testid="application-cv-preview"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-1 xl:col-span-6 xl:col-start-4 xl:h-full ${className}`}
    >
      <header className="aw-panel-head">
        <div className="min-w-0">
          <h2 id="application-cv-preview-title" className="aw-panel-title flex items-center gap-2">
            <FileTextOutlined className="text-slate-400" aria-hidden /> Xem trước CV
          </h2>
          {selectedPublicId && <p className="aw-panel-sub truncate">{cvTitle}</p>}
        </div>
        {previewDocument && <span className="aw-count">{Math.round(previewZoom * 100)}%</span>}
      </header>
      {selectedPublicId && (
        <div className="aw-actionbar" role="toolbar" aria-label="Thao tác với CV">
          <DownloadApplicationCvButton publicId={selectedPublicId} candidateName={candidateName} sourceFile={sourceFile} />
          <ShareApplicationReviewButton
            publicId={selectedPublicId}
            candidateName={candidateName}
            jobTitle={selectedApplication?.job_title || ''}
            disabledReason={sourceFile ? 'CV là tệp ứng viên tải lên nên không thể ẩn thông tin liên hệ để chia sẻ.' : ''}
          />
          <Tooltip title="Nhắn tin với ứng viên sắp ra mắt">
            <span className="aw-actionbar__end">
              <Button size="small" icon={<MessageOutlined />} disabled>Nhắn tin</Button>
            </span>
          </Tooltip>
        </div>
      )}

      <div className="min-h-96 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-3 sm:p-4">
        {!selectedPublicId && (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chọn một CV ở cột bên trái để xem bản đã nộp"
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
            message="Không thể tải bản CV đã nộp"
            description={getApiErrorMessage(error, 'Vui lòng thử lại sau.')}
            action={<Button size="small" danger onClick={onRetry}>Thử lại</Button>}
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
            <Empty description="Hồ sơ này chưa có bản xem trước CV" />
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
          <span>{sourceFile ? 'Tệp CV ứng viên đã nộp' : 'Bản CV tại thời điểm ứng viên nộp'}</span>
          <span className="aw-source">{sourceFile ? SOURCE_LABELS.uploaded : SOURCE_LABELS[snapshot.submitted_cv_source] || snapshot.submitted_cv_source || 'Nguồn CV'}</span>
        </footer>
      )}
    </section>
  )
}
