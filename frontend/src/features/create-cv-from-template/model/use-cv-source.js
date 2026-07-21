// State + nghiệp vụ của bảng chọn nguồn nội dung khi tạo CV từ mẫu.
// UI (ui/CvSourcePanel.jsx) chỉ render theo giá trị hook trả về.
import { useEffect, useState } from 'react'
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
import { message } from '@/shared/lib/toast'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'
import { resolvePreviewSelection } from './preview-selection'

function importFailureMessage(code) {
  if (code === 'scanned_pdf_ocr_unavailable') return 'PDF là bản scan chưa có lớp chữ. Hãy dùng PDF có thể bôi đen chữ hoặc tệp DOCX.'
  if (code === 'import_timeout') return 'Quá trình phân tích vẫn đang chạy. Bạn có thể thử kiểm tra lại.'
  if (code === 'too_many_pages') return 'CV vượt quá giới hạn 20 trang.'
  return 'Không thể phân tích tệp thành CV. Bạn có thể thử lại hoặc tạo CV trống.'
}

export function useCvSource({ template, locale, themeColor, onCreated, onPreviewChange, onRequireLogin }) {
  const { user, isAuthenticated } = useSession()
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

  return {
    locales,
    source,
    setSource,
    myCvs,
    selectedCvId,
    setSelectedCvId,
    recoverable,
    sampleLocale,
    setSampleLocale,
    positions,
    loadingPositions,
    loadingPreview,
    previewError,
    selectedPosition,
    setSelectedPosition,
    submitting,
    uploadFile,
    setUploadFile,
    importCvId,
    importError,
    setImportError,
    canSubmit,
    retryUpload,
    submit,
  }
}
