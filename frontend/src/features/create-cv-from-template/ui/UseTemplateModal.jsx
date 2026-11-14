import { Modal } from 'antd'
import { useCallback, useState } from 'react'
import { DEFAULT_CV_EXPERIENCE_BAND } from '@/entities/cv-template'
import { useCvSource } from '../model/use-cv-source'
import CvSourcePanel from './CvSourcePanel'
import CvSourcePreview from './CvSourcePreview'

function ModalBody({ template, themeColor, locale, onCreated, onRequireLogin }) {
  const [selection, setSelection] = useState({ source: 'sample', sampleLocale: locale, experienceBand: DEFAULT_CV_EXPERIENCE_BAND, positionSlug: null })
  const select = useCallback((patch) => setSelection((current) => ({ ...current, ...patch })), [])
  const cv = useCvSource({ template, locale, selection, onSelectionChange: select, themeColor, onCreated, onRequireLogin })
  return <div className="-mx-6 -my-5 grid min-h-[75vh] grid-cols-1 lg:grid-cols-10">
    <div className="order-2 p-6 lg:order-1 lg:col-span-7">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Mẫu CV {template.display_name}</h2>
      <div className="h-[72vh] overflow-y-auto rounded-xl border border-slate-200 bg-[#f8fafc] p-3 [scrollbar-gutter:stable]">
        <CvSourcePreview preview={cv.preview} themeColor={themeColor} />
      </div>
    </div>
    <div className="order-1 flex max-h-[70vh] flex-col overflow-y-auto border-b border-slate-200 bg-slate-50 p-6 lg:order-2 lg:col-span-3 lg:max-h-none lg:overflow-visible lg:border-b-0 lg:border-l">
      <h3 className="mb-3.5 text-base font-bold text-[var(--brand-primary)]">Bạn muốn tạo CV từ?</h3>
      <CvSourcePanel cv={cv} />
    </div>
  </div>
}

// Hộp "Dùng mẫu" ở kho mẫu: lựa chọn giữ trong state (không đổi URL kho mẫu).
export default function UseTemplateModal({ template, themeColor, open, onClose, onCreated, locale = 'vi-VN', onRequireLogin }) {
  if (!template) return null
  return <Modal open={open} onCancel={onClose} footer={null} width={1200} style={{ top: 24, maxWidth: '96vw' }} destroyOnHidden transitionName="modal-slide-down">
    <ModalBody key={`${template.public_id}:${locale}`} template={template} themeColor={themeColor} locale={locale} onCreated={onCreated} onRequireLogin={onRequireLogin} />
  </Modal>
}
