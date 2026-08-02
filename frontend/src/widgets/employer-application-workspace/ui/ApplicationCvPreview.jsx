import {
  FileTextOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Skeleton } from 'antd'
import { CvDocumentPreview } from '@/entities/cv'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { documentFromVersion } from '../model/application-workspace'

const SOURCE_LABELS = {
  builder: 'Tạo trên hệ thống',
  upload: 'CV tải lên',
  imported: 'CV nhập vào',
}

export default function ApplicationCvPreview({
  selectedApplication,
  snapshot,
  selectedPublicId,
  loading,
  error,
  onRetry,
  className = '',
}) {
  const previewDocument = documentFromVersion(snapshot?.cv)
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
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
        <div className="min-w-0">
          <h2 id="application-cv-preview-title" className="flex items-center gap-2 truncate text-base font-bold text-slate-900">
            <FileTextOutlined className="text-slate-400" aria-hidden /> Xem trước CV
          </h2>
          {selectedPublicId && <p className="mt-0.5 truncate text-xs text-slate-500">{cvTitle}</p>}
        </div>
        {previewDocument && (
          <span className="shrink-0 text-xs font-medium text-slate-400">{Math.round(previewZoom * 100)}%</span>
        )}
      </header>

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
        {selectedPublicId && !loading && !error && !previewDocument && (
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

      {previewDocument && (
        <footer className="border-t border-slate-100 bg-white px-4 py-2.5 text-[11px] text-slate-500">
          Bản CV tại thời điểm ứng viên nộp · {SOURCE_LABELS[snapshot.submitted_cv_source] || snapshot.submitted_cv_source || 'Nguồn CV'}
        </footer>
      )}
    </section>
  )
}
