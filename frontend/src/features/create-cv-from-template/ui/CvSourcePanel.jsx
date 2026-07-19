import { InboxOutlined } from '@ant-design/icons'
import { Select, Spin, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getLatestRecoverableDraft,
  getMyCvs,
  importCvFile,
  retryCvImport,
  switchCvTemplate,
  waitForCvImport,
} from '@/entities/cv'
import { getCvPositionOptions } from '@/entities/cv-template'
import { useLocales } from '@/entities/locale'
import { useSession } from '@/entities/session'
import { useSiteSettings } from '@/entities/site-settings'
import { message } from '@/shared/lib/toast'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'
import { resolvePreviewSelection } from '../model/preview-selection'

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

export default function CvSourcePanel({ template, locale = 'vi-VN', themeColor, onCreated, onBack, onPreviewChange, onRequireLogin }) {
  const { user, isAuthenticated } = useSession()
  const { siteName } = useSiteSettings()
  const { locales } = useLocales()
  const [source, setSource] = useState('sample')
  const [myCvs, setMyCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [recoverable, setRecoverable] = useState(null)
  const [sampleLocale, setSampleLocale] = useState(locale)
  const [positions, setPositions] = useState([])
  const [positionsLocale, setPositionsLocale] = useState(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewAvailable, setPreviewAvailable] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [importCvId, setImportCvId] = useState(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    setSource('sample')
    setSelectedCvId(null)
    setSelectedPosition(null)
    setUploadFile(null)
    setImportCvId(null)
    setImportError('')
    const selectedLocale = locales.find((item) => item.code === locale)
      || locales.find((item) => item.is_default)
      || locales.find((item) => item.code === 'vi-VN')
      || locales[0]
    setSampleLocale(selectedLocale?.code || 'vi-VN')
    setPositionsLocale(null)
    onPreviewChange?.(null)

    let cancelled = false
    if (isAuthenticated && user?.role === 'candidate') {
      getMyCvs()
        .then((data) => {
          if (cancelled) return
          setMyCvs(data)
          setSelectedCvId(data[0]?.public_id || null)
        })
        .catch(() => !cancelled && setMyCvs([]))
      getLatestRecoverableDraft()
        .then((data) => !cancelled && setRecoverable(data))
        .catch(() => !cancelled && setRecoverable(null))
    } else {
      setMyCvs([])
      setRecoverable(null)
    }
    return () => {
      cancelled = true
    }
  }, [template, locale, locales, isAuthenticated, user, onPreviewChange])

  useEffect(() => {
    if (source !== 'sample') return undefined
    const controller = new AbortController()
    setPositionsLocale(null)
    setLoadingPositions(true)
    getCvPositionOptions(sampleLocale, '', controller.signal)
      .then((data) => {
        setPositions(data)
        setPositionsLocale(sampleLocale)
        setSelectedPosition((current) => {
          const options = data.map((position) => position.public_id).filter(Boolean)
          return current && options.includes(current) ? current : (options[0] || null)
        })
      })
      .catch((error) => {
        if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return
        setPositions([])
        setPositionsLocale(sampleLocale)
        setSelectedPosition(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPositions(false)
      })
    return () => {
      controller.abort()
    }
  }, [source, sampleLocale])

  useEffect(() => {
    const selection = resolvePreviewSelection({
      source,
      locale,
      sampleLocale,
      positionsLocale,
      positions,
      loadingPositions,
      selectedPosition,
      selectedCvId,
      recoverable,
      templatePublicId: template.public_id,
    })
    if (selection.state === 'unavailable') {
      setPreviewAvailable(false)
      setPreviewError('')
      onPreviewChange?.({ unavailable: true })
      return undefined
    }
    if (selection.state !== 'ready') {
      setPreviewAvailable(false)
      if (selection.state === 'empty') {
        setPreviewError(source === 'sample'
          ? 'Chưa có nội dung CV mẫu cho ngôn ngữ này.'
          : 'Không có dữ liệu CV phù hợp để xem trước.')
        onPreviewChange?.({ empty: true })
      } else {
        onPreviewChange?.(null)
      }
      return undefined
    }
    const controller = new AbortController()
    setLoadingPreview(true)
    setPreviewAvailable(false)
    setPreviewError('')
    onPreviewChange?.(null)
    selection.load(controller.signal)
      .then((data) => {
        setPreviewAvailable(Boolean(data.document))
        onPreviewChange?.(data)
      })
      .catch((error) => {
        if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return
        setPreviewError('Không thể tải bản xem trước. Vui lòng chọn lại nội dung.')
        onPreviewChange?.({ error: true })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreview(false)
      })
    return () => {
      controller.abort()
    }
  }, [
    source,
    selectedPosition,
    sampleLocale,
    positionsLocale,
    positions,
    loadingPositions,
    locale,
    template.public_id,
    selectedCvId,
    recoverable,
    onPreviewChange,
  ])

  const sourceReady = source === 'blank'
    || (source === 'sample' && Boolean(selectedPosition))
    || (source === 'previous' && Boolean(selectedCvId))
    || (source === 'restore' && Boolean(recoverable))
    || (source === 'upload' && Boolean(uploadFile))
  const canSubmit = sourceReady && (source === 'upload' || previewAvailable)

  const importFailureMessage = (code) => {
    if (code === 'scanned_pdf_ocr_unavailable') return 'PDF là bản scan chưa có lớp chữ. Hãy dùng PDF có thể bôi đen chữ hoặc tệp DOCX.'
    if (code === 'import_timeout') return 'Quá trình phân tích vẫn đang chạy. Bạn có thể thử kiểm tra lại.'
    if (code === 'too_many_pages') return 'CV vượt quá giới hạn 20 trang.'
    return 'Không thể phân tích tệp thành CV. Bạn có thể thử lại hoặc tạo CV trống.'
  }

  const pollImport = async (publicId) => {
    const analyzed = await waitForCvImport(publicId)
    message.success('Đã phân tích CV và chuyển thành nội dung có thể chỉnh sửa.')
    onCreated?.(analyzed)
  }

  const retryUpload = async () => {
    if (!importCvId) return
    setSubmitting(true)
    setImportError('')
    try {
      await retryCvImport(importCvId)
      await pollImport(importCvId)
    } catch (error) {
      setImportError(importFailureMessage(error.code))
    } finally {
      setSubmitting(false)
    }
  }

  const submit = async () => {
    if (!isAuthenticated) {
      onRequireLogin?.()
      return
    }
    if (user?.role !== 'candidate') {
      message.warning('Hãy đăng nhập bằng tài khoản ứng viên để tạo CV.')
      return
    }
    if (!user?.email_verified) {
      message.warning('Bạn cần xác thực email trước khi tạo CV.')
      return
    }
    setSubmitting(true)
    try {
      if (source === 'upload') {
        setImportError('')
        const queued = await importCvFile(uploadFile, uploadFile.name, {
          templatePublicId: template.public_id,
          language: sampleLocale || locale,
          themeColor,
          idempotencyKey: globalThis.crypto?.randomUUID?.() || `import-${Date.now()}`,
        })
        setImportCvId(queued.public_id)
        await pollImport(queued.public_id)
        return
      }
      if (source === 'restore') {
        const result = await switchCvTemplate(
          recoverable.cv.public_id,
          template.public_id,
          recoverable.draft.lock_version,
          globalThis.crypto?.randomUUID?.() || `restore-${Date.now()}`,
          themeColor,
        )
        message.success('Đã khôi phục bản chỉnh sửa gần nhất trên mẫu mới.')
        onCreated?.(result.cv)
        return
      }
      const cv = await createCvFromTemplate({
        title: `CV ${template.display_name}`,
        template_public_id: template.public_id,
        language: source === 'sample' ? sampleLocale : locale,
        ...(themeColor ? { theme_color: themeColor } : {}),
        ...(source === 'sample' ? { position_public_id: selectedPosition } : {}),
        ...(source === 'previous' ? { source_cv_public_id: selectedCvId } : {}),
      })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      if (source === 'upload') {
        setImportError(importFailureMessage(error.code))
      } else {
        message.error(createCvErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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
            </div>
          </SourceOption>
        )}

        <SourceOption value="sample" current={source} onSelect={setSource} title={`Nội dung CV mẫu ${siteName} gợi ý`}>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Chọn ngôn ngữ</p>
            <div className="flex flex-wrap gap-1.5">
              {locales.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSampleLocale(item.code)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer',
                    sampleLocale === item.code
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {item.label_vi}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-xs font-semibold text-slate-700">Chọn vị trí</p>
            <Select
              showSearch
              virtual={false}
              className="w-full"
              placeholder="Nhập để tìm kiếm vị trí"
              loading={loadingPositions || loadingPreview}
              value={selectedPosition}
              onChange={(val) => setSelectedPosition(val)}
              optionFilterProp="label"
              notFoundContent={loadingPositions ? <Spin size="small" /> : 'Không tìm thấy vị trí chuyên môn'}
              options={positions.map((position) => ({
                value: position.public_id,
                label: position.display_name || position.name_vi,
              }))}
            />
            {previewError && <p className="mt-1.5 text-xs leading-5 text-amber-600">{previewError}</p>}
          </div>
        </SourceOption>

        <SourceOption
          value="upload"
          current={source}
          onSelect={setSource}
          title={(
            <>Nội dung CV từ máy tính của bạn</>
          )}
        >
          <div>
            <Upload.Dragger
              accept=".pdf,.docx"
              maxCount={1}
              beforeUpload={(file) => { setUploadFile(file); setImportError(''); return false }}
              onRemove={() => { setUploadFile(null); setImportCvId(null); setImportError('') }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="px-2 text-sm">Chọn hoặc kéo thả tệp CV vào đây</p>
              <p className="px-2 text-xs text-slate-500">Hỗ trợ .pdf hoặc .docx, tối đa 5MB và 20 trang</p>
            </Upload.Dragger>
            {submitting && <p className="mt-2 text-xs leading-5 text-slate-500">Đang trích xuất và chuẩn hóa nội dung CV…</p>}
            {importError && <p className="mt-2 text-xs leading-5 text-amber-600">{importError}</p>}
            {importCvId && importError && (
              <div className="mt-2 flex gap-3">
                <button type="button" className="text-xs font-semibold text-[var(--brand-primary)]" onClick={retryUpload}>Thử phân tích lại</button>
                <button type="button" className="text-xs font-semibold text-slate-600" onClick={() => setSource('blank')}>Tạo CV trống</button>
              </div>
            )}
          </div>
        </SourceOption>

        <SourceOption
          value="restore"
          current={source}
          onSelect={setSource}
          title="Khôi phục bản chưa lưu"
          note={recoverable?.cv?.draft_updated_at
            ? `Tiếp tục bản gần nhất lúc ${new Date(recoverable.cv.draft_updated_at).toLocaleString('vi-VN')}`
            : 'Không có bản đang chỉnh sửa cần khôi phục'}
          disabled={!recoverable}
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
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
        >
          {submitting ? 'Đang xử lý…' : (source === 'restore' ? 'Tiếp tục chỉnh sửa' : (source === 'upload' ? 'Phân tích và tạo CV' : 'Tạo CV'))}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-lg border border-[#00b14f] bg-white py-2 text-sm font-semibold text-[#00b14f] transition hover:bg-slate-50 cursor-pointer mt-3 flex items-center justify-center gap-1.5"
          >
            ← Quay lại danh sách mẫu CV
          </button>
        )}
      </div>
    </>
  )
}
