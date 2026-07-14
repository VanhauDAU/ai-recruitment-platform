import { InboxOutlined, LinkedinFilled } from '@ant-design/icons'
import { Modal, Select, Spin, Upload, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CvDocumentPreview, getMyCvs } from '@/entities/cv'
import { getCvSampleContent, getCvSampleContents, getCvTemplate } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { useSiteSettings } from '@/entities/site-settings'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'
import { buildDocumentFromSampleContent, buildSamplePreviewDocument } from '../model/sample-preview'

const SAMPLE_LOCALES = [
  { value: 'vi-VN', label: 'Tiếng Việt' },
  { value: 'en-US', label: 'Tiếng Anh' },
  { value: 'ja-JP', label: 'Tiếng Nhật' },
  { value: 'zh-CN', label: 'Tiếng Trung' },
]

function SourceOption({ value, current, onSelect, title, note, disabled, children }) {
  const active = current === value
  return (
    <div
      className={[
        'rounded-xl border bg-white transition-all duration-200',
        active ? 'border-[var(--brand-primary)] shadow-sm' : 'border-slate-200 hover:border-[var(--brand-primary)]',
        disabled ? 'opacity-55' : 'cursor-pointer',
      ].join(' ')}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left disabled:cursor-not-allowed cursor-pointer"
      >
        <span
          aria-hidden
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
            active ? 'border-[var(--brand-primary)]' : 'border-slate-300',
          ].join(' ')}
        >
          {active && <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />}
        </span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold transition-colors duration-200 ${active ? 'text-[var(--brand-primary)]' : 'text-slate-800'}`}>{title}</span>
          {note && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{note}</span>}
        </span>
      </button>
      {active && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function UseTemplateModal({ template, themeColor, open, onClose, onCreated, locale = 'vi-VN' }) {
  const { user, isAuthenticated } = useSession()
  const { siteName } = useSiteSettings()
  const [source, setSource] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [myCvs, setMyCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [sampleLocale, setSampleLocale] = useState(locale)
  const [samples, setSamples] = useState([])
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [sampleContent, setSampleContent] = useState(null)
  const [submitting, setSubmitting] = useState(false)
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
    setSource(null)
    setSelectedCvId(null)
    setSelectedPosition(null)
    setSampleContent(null)
    setSampleLocale(locale)
    setLoadingDetail(true)
    let cancelled = false
    getCvTemplate(template.slug, locale)
      .then((data) => !cancelled && setDetail(data))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setLoadingDetail(false))
    if (isAuthenticated && user?.role === 'candidate') {
      getMyCvs().then((data) => !cancelled && setMyCvs(data)).catch(() => !cancelled && setMyCvs([]))
    } else {
      setMyCvs([])
    }
    return () => { cancelled = true }
  }, [open, template, locale, isAuthenticated, user])

  useEffect(() => {
    if (!open || source !== 'sample') return undefined
    let cancelled = false
    setLoadingSamples(true)
    getCvSampleContents(sampleLocale)
      .then((data) => !cancelled && setSamples(data))
      .catch(() => !cancelled && setSamples([]))
      .finally(() => !cancelled && setLoadingSamples(false))
    return () => { cancelled = true }
  }, [open, source, sampleLocale])

  // Vị trí chọn theo tên danh mục (ổn định giữa các ngôn ngữ); public_id đổi theo locale.
  const samplePublicId = useMemo(
    () => samples.find((item) => item.job_category_name === selectedPosition)?.public_id || null,
    [samples, selectedPosition],
  )

  useEffect(() => {
    if (source !== 'sample' || !samplePublicId) {
      setSampleContent(null)
      return undefined
    }
    let cancelled = false
    getCvSampleContent(samplePublicId)
      .then((data) => !cancelled && setSampleContent(data))
      .catch(() => !cancelled && setSampleContent(null))
    return () => { cancelled = true }
  }, [source, samplePublicId])

  const previewDocument = useMemo(() => {
    if (!detail) return null
    if (source === 'sample' && sampleContent) {
      return buildDocumentFromSampleContent(detail, sampleContent, themeColor)
    }
    return buildSamplePreviewDocument(detail, themeColor)
  }, [detail, source, sampleContent, themeColor])

  const canSubmit = source === 'blank' || (source === 'sample' && Boolean(samplePublicId))
  const pendingBackend = source === 'previous' || source === 'upload'

  const submit = async () => {
    if (!isAuthenticated || user?.role !== 'candidate') {
      message.warning('Hãy đăng nhập bằng tài khoản ứng viên để tạo CV.')
      return
    }
    if (!user?.email_verified) {
      message.warning('Bạn cần xác thực email trước khi tạo CV.')
      return
    }
    setSubmitting(true)
    try {
      const cv = await createCvFromTemplate({
        title: `CV ${template.display_name}`,
        template_public_id: template.public_id,
        language: source === 'sample' ? sampleLocale : locale,
        ...(source === 'sample' ? { sample_content_public_id: samplePublicId } : {}),
      })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      message.error(createCvErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (!template) return null

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 24, maxWidth: '96vw' }}
      destroyOnHidden
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
          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {myCvs.length > 0 && (
              <SourceOption value="previous" current={source} onSelect={setSource} title="Nội dung CV đã tạo trước đó">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {myCvs.map((cv) => (
                    <button
                      key={cv.public_id}
                      type="button"
                      onClick={() => setSelectedCvId(cv.public_id)}
                      className={[
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left cursor-pointer transition-all duration-200',
                        selectedCvId === cv.public_id 
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft,#f0fdf4)]' 
                          : 'border-slate-200 hover:border-[var(--brand-primary)] bg-white',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${selectedCvId === cv.public_id ? 'border-[var(--brand-primary)]' : 'border-slate-300'}`}
                      >
                        {selectedCvId === cv.public_id && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{cv.title}</span>
                        <span className="block text-xs text-slate-500">{cv.updated_at ? new Date(cv.updated_at).toLocaleDateString('vi-VN') : ''}</span>
                      </span>
                      <Link to={`/cvs/${cv.public_id}/view`} target="_blank" className="shrink-0 text-xs font-medium text-[#00b14f] hover:text-[#008a3e] cursor-pointer" onClick={(event) => event.stopPropagation()}>
                        (Xem CV)
                      </Link>
                    </button>
                  ))}
                  <p className="text-xs leading-5 text-amber-600 mt-1">Sao chép nội dung từ CV có sẵn sẽ sớm được kích hoạt.</p>
                </div>
              </SourceOption>
            )}

            <SourceOption value="sample" current={source} onSelect={setSource} title={`Nội dung CV mẫu ${siteName} gợi ý`}>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-700">Chọn ngôn ngữ</p>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_LOCALES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSampleLocale(item.value)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
                        sampleLocale === item.value
                          ? 'bg-[var(--brand-primary)] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="mb-1.5 mt-3 text-xs font-semibold text-slate-700">Chọn vị trí</p>
                <Select
                  showSearch
                  className="w-full"
                  placeholder="Nhập để tìm kiếm vị trí"
                  loading={loadingSamples}
                  value={selectedPosition}
                  onChange={(val) => setSelectedPosition(val)}
                  optionFilterProp="label"
                  notFoundContent={loadingSamples ? <Spin size="small" /> : 'Chưa có nội dung mẫu phù hợp'}
                  options={samples.map((sample) => ({
                    value: sample.job_category_name || sample.title,
                    label: sample.job_category_name || sample.title,
                  }))}
                />
              </div>
            </SourceOption>

            <SourceOption
              value="upload"
              current={source}
              onSelect={setSource}
              title={(
                <>Nội dung CV từ máy tính của bạn hoặc <LinkedinFilled className="text-[#0a66c2]" /> LinkedIn</>
              )}
            >
              <div>
                <Upload.Dragger accept=".pdf,.doc,.docx" maxCount={1} beforeUpload={() => false}>
                  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                  <p className="px-2 text-sm">Chọn hoặc kéo thả tệp CV vào đây</p>
                  <p className="px-2 text-xs text-slate-500">Hỗ trợ định dạng .pdf, .doc, .docx (tối đa 5MB)</p>
                </Upload.Dragger>
                <p className="mt-2 text-xs leading-5 text-amber-600">Nhập nội dung từ tệp sẽ sớm được kích hoạt.</p>
              </div>
            </SourceOption>

            <SourceOption
              value="restore"
              current={source}
              onSelect={setSource}
              title="Khôi phục bản chưa lưu"
              note="Tiếp tục chỉnh sửa từ bản CV gần nhất bạn chưa lưu"
              disabled
            />

            <SourceOption
              value="blank"
              current={source}
              onSelect={setSource}
              title="Tạo CV từ đầu"
              note="Bắt đầu từ một khung CV trắng không có nội dung gợi ý"
            />
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            {pendingBackend && (
              <p className="mb-2 text-xs leading-5 text-amber-600">Lựa chọn này sẽ sớm được hỗ trợ. Hãy chọn nội dung mẫu hoặc tạo CV từ đầu.</p>
            )}
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={submit}
              className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
            >
              {submitting ? 'Đang tạo…' : 'Tạo CV'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
