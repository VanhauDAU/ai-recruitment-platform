import { Modal, Spin } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CvDocumentPreview } from '@/entities/cv'
import { getCvTemplate } from '@/entities/cv-template'
import { buildDocumentFromSampleContent, buildSamplePreviewDocument } from '../model/sample-preview'
import CvSourcePanel from './CvSourcePanel'

export default function UseTemplateModal({ template, themeColor, open, onClose, onCreated, locale = 'vi-VN' }) {
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sampleContent, setSampleContent] = useState(null)
  const previewWrapRef = useRef(null)
  const [previewZoom, setPreviewZoom] = useState(1)

  // Co bản A4 (~842px cả padding) vừa khít chiều ngang cột trái, không cuộn ngang.
  useEffect(() => {
    if (!open) return undefined
    const element = previewWrapRef.current
    if (!element) return undefined
    const fit = () => setPreviewZoom(Math.min(1, element.clientWidth / 842))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [open, loadingDetail])

  useEffect(() => {
    if (!open || !template) return
    setDetail(null)
    setSampleContent(null)
    setLoadingDetail(true)
    let cancelled = false
    getCvTemplate(template.slug, locale)
      .then((data) => !cancelled && setDetail(data))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setLoadingDetail(false))
    return () => {
      cancelled = true
    }
  }, [open, template, locale])

  const previewDocument = useMemo(() => {
    if (!detail) return null
    if (sampleContent) {
      return buildDocumentFromSampleContent(detail, sampleContent, themeColor)
    }
    return buildSamplePreviewDocument(detail, themeColor)
  }, [detail, sampleContent, themeColor])

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
        <div className="p-6 lg:col-span-7">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Mẫu CV {template.display_name}</h2>
          <div ref={previewWrapRef} className="h-[72vh] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-[#f8fafc]">
            {loadingDetail || !previewDocument ? (
              <div className="flex h-full items-center justify-center">
                {loadingDetail ? <Spin /> : <p className="text-sm text-slate-500">Không tải được bản xem trước.</p>}
              </div>
            ) : (
              <div style={{ zoom: previewZoom }}>
                <CvDocumentPreview document={previewDocument} rendererKey={detail.renderer?.key} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:col-span-3 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-6">
          <h3 className="mb-3.5 text-base font-bold text-[var(--brand-primary)]">Bạn muốn tạo CV từ?</h3>
          <CvSourcePanel
            template={template}
            locale={locale}
            themeColor={themeColor}
            onCreated={onCreated}
            onSampleContentChange={setSampleContent}
          />
        </div>
      </div>
    </Modal>
  )
}
