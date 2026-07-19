import { Modal, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { CvDocumentPreview } from '@/entities/cv'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import CvSourcePanel from './CvSourcePanel'

export default function UseTemplateModal({ template, themeColor, open, onClose, onCreated, locale = 'vi-VN', onRequireLogin }) {
  const [preview, setPreview] = useState(null)
  const { containerRef: previewWrapRef, zoom: previewZoom } = usePreviewFitZoom(open)

  useEffect(() => {
    if (!open || !template) return
    setPreview(null)
  }, [open, template, locale])

  const previewDocument = useMemo(() => {
    if (!preview?.document) return null
    if (!themeColor) return preview.document
    return {
      ...preview.document,
      style_json: { ...preview.document.style_json, theme_color: themeColor },
    }
  }, [preview, themeColor])

  if (!template) return null

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 24, maxWidth: '96vw' }}
      destroyOnHidden
      transitionName="modal-slide-down"
    >
      {/* Container flex/grid âm để đẩy sát lề Modal padding mặc định */}
      <div className="grid grid-cols-1 lg:grid-cols-10 -mx-6 -my-5 min-h-[75vh]">
        <div className="order-2 p-6 lg:order-1 lg:col-span-7">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Mẫu CV {template.display_name}</h2>
          <div ref={previewWrapRef} className="h-[72vh] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-[#f8fafc]">
            {!previewDocument ? (
              <div className="mx-auto min-h-full w-full max-w-[794px] bg-white p-10 shadow-sm">
                {preview?.empty && <p className="py-20 text-center text-sm text-slate-500">Chưa có nội dung CV mẫu cho ngôn ngữ này.</p>}
                {preview?.error && <p className="py-20 text-center text-sm text-rose-600">Không tải được bản xem trước.</p>}
                {preview?.unavailable && <p className="py-20 text-center text-sm text-slate-500">Bản xem trước cho nguồn này sẽ được hiển thị khi workflow sẵn sàng.</p>}
                {!preview && <Skeleton active paragraph={{ rows: 16 }} />}
              </div>
            ) : (
              <div style={{ zoom: previewZoom }}>
                <CvDocumentPreview document={previewDocument} rendererKey={preview.renderer?.key} />
              </div>
            )}
          </div>
        </div>

        <div className="order-1 flex max-h-[70vh] flex-col overflow-y-auto border-b border-slate-200 bg-slate-50 p-6 lg:order-2 lg:col-span-3 lg:max-h-none lg:overflow-visible lg:border-b-0 lg:border-l">
          <h3 className="mb-3.5 text-base font-bold text-[var(--brand-primary)]">Bạn muốn tạo CV từ?</h3>
          <CvSourcePanel
            template={template}
            locale={locale}
            themeColor={themeColor}
            onCreated={onCreated}
            onPreviewChange={setPreview}
            onRequireLogin={onRequireLogin}
          />
        </div>
      </div>
    </Modal>
  )
}
