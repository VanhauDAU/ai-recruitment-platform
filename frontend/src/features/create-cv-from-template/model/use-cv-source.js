// State + nghiệp vụ của bảng chọn nguồn nội dung khi tạo CV từ mẫu.
// UI (ui/CvSourcePanel.jsx) chỉ render theo giá trị hook trả về.
//
// Hook không tự reset khi đổi mẫu/ngôn ngữ: component cha phải đặt `key`
// theo `template.public_id` + `locale` để mount lại. Nhờ vậy không còn effect
// reset chạy lại khi dữ liệu phụ (ngôn ngữ, phiên đăng nhập) tải xong — nguyên
// nhân preview kẹt ở trạng thái chờ trước CVT-0.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getMyCvs,
  importCvFile,
  retryCvImport,
  waitForCvImport,
} from '@/entities/cv'
import { getCvPositionOptions } from '@/entities/cv-template'
import { useLocales } from '@/entities/locale'
import { useSession } from '@/entities/session'
import { message } from '@/shared/lib/toast'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'
import { resolvePreviewSelection } from './preview-selection'

export const CV_SOURCES = ['sample', 'previous', 'upload', 'blank']

function importFailureMessage(code) {
  if (code === 'scanned_pdf_ocr_unavailable') return 'PDF là bản scan chưa có lớp chữ. Hãy dùng PDF có thể bôi đen chữ hoặc tệp DOCX.'
  if (code === 'import_timeout') return 'Quá trình phân tích vẫn đang chạy. Bạn có thể thử kiểm tra lại.'
  if (code === 'too_many_pages') return 'CV vượt quá giới hạn 20 trang.'
  return 'Không thể phân tích tệp thành CV. Bạn có thể thử lại hoặc tạo CV trống.'
}

function isAbort(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError'
}

function useLatest(value) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref
}

export function useCvSource({
  template,
  locale,
  themeColor,
  initialSelection,
  onSelectionChange,
  onCreated,
  onPreviewChange,
  onRequireLogin,
}) {
  const { user, isAuthenticated } = useSession()
  const { locales } = useLocales()
  const candidateId = isAuthenticated && user?.role === 'candidate' ? user.public_id || 'candidate' : null
  const templateId = template.public_id
  const previewChangeRef = useLatest(onPreviewChange)
  const selectionChangeRef = useLatest(onSelectionChange)
  const pendingPositionSlug = useRef(initialSelection?.positionSlug || null)

  const [source, setSource] = useState(() => (CV_SOURCES.includes(initialSelection?.source) ? initialSelection.source : 'sample'))
  const [sampleLocale, setSampleLocale] = useState(() => initialSelection?.sampleLocale || locale)
  const [myCvs, setMyCvs] = useState({ owner: null, items: [] })
  const [selectedCvId, setSelectedCvId] = useState(null)
  const [positions, setPositions] = useState({ locale: null, items: [] })
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewAvailable, setPreviewAvailable] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [importCvId, setImportCvId] = useState(null)
  const [importError, setImportError] = useState('')
  const [uploadState, setUploadState] = useState(null)

  const loadingPositions = positions.locale !== sampleLocale
  const cvsLoaded = myCvs.owner === candidateId
  const availableCvs = cvsLoaded ? myCvs.items : []
  // "CV đã tạo" chỉ hợp lệ khi đã tải xong và có ít nhất một CV.
  const activeSource = source === 'previous' && (!candidateId || (cvsLoaded && availableCvs.length === 0)) ? 'sample' : source

  useEffect(() => {
    if (!candidateId) return undefined
    let cancelled = false
    getMyCvs()
      .then((data) => {
        if (cancelled) return
        setMyCvs({ owner: candidateId, items: data })
        setSelectedCvId((current) => current || data[0]?.public_id || null)
      })
      .catch(() => !cancelled && setMyCvs({ owner: candidateId, items: [] }))
    return () => { cancelled = true }
  }, [candidateId])

  useEffect(() => {
    const controller = new AbortController()
    getCvPositionOptions(sampleLocale, '', controller.signal)
      .then((data) => {
        // Đọc slug từ URL ngoài updater: StrictMode gọi updater hai lần.
        const wanted = pendingPositionSlug.current
        pendingPositionSlug.current = null
        const fromSlug = wanted && data.find((position) => position.slug === wanted)
        setPositions({ locale: sampleLocale, items: data })
        setSelectedPosition((current) => {
          if (fromSlug) return fromSlug.public_id
          if (current && data.some((position) => position.public_id === current)) return current
          return data[0]?.public_id || null
        })
      })
      .catch((error) => {
        if (isAbort(error)) return
        setPositions({ locale: sampleLocale, items: [] })
        setSelectedPosition(null)
      })
    return () => controller.abort()
  }, [sampleLocale])

  useEffect(() => {
    const notify = (value) => previewChangeRef.current?.(value)
    const selection = resolvePreviewSelection({
      source: activeSource,
      locale,
      sampleLocale,
      positionsLocale: positions.locale,
      positions: positions.items,
      loadingPositions,
      selectedPosition,
      selectedCvId,
      templatePublicId: templateId,
    })
    if (selection.state === 'unavailable') {
      setPreviewAvailable(false)
      setPreviewError('')
      notify({ unavailable: true })
      return undefined
    }
    if (selection.state !== 'ready') {
      setPreviewAvailable(false)
      if (selection.state === 'empty') {
        setPreviewError(activeSource === 'sample'
          ? 'Chưa có nội dung CV mẫu cho ngôn ngữ này.'
          : 'Không có dữ liệu CV phù hợp để xem trước.')
        notify({ empty: true })
      } else {
        notify(null)
      }
      return undefined
    }
    const controller = new AbortController()
    setLoadingPreview(true)
    setPreviewAvailable(false)
    setPreviewError('')
    selection.load(controller.signal)
      .then((data) => {
        setPreviewAvailable(Boolean(data.document))
        notify(data)
      })
      .catch((error) => {
        if (isAbort(error)) return
        setPreviewError('Không thể tải bản xem trước. Vui lòng chọn lại nội dung.')
        notify({ error: true })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreview(false)
      })
    return () => controller.abort()
  }, [activeSource, locale, sampleLocale, positions, loadingPositions, selectedPosition, selectedCvId, templateId, previewChangeRef])

  const position = useMemo(
    () => positions.items.find((item) => item.public_id === selectedPosition) || null,
    [positions.items, selectedPosition],
  )
  const positionSlug = position?.slug || null
  const positionLabel = position?.display_name || position?.name_vi || null

  useEffect(() => {
    // Chờ danh sách vị trí để không xóa `vi-tri` khỏi URL trong lúc đang tải.
    if (activeSource === 'sample' && loadingPositions) return
    selectionChangeRef.current?.({
      source: activeSource,
      sampleLocale,
      position: positionSlug ? { slug: positionSlug, label: positionLabel } : null,
    })
  }, [activeSource, sampleLocale, loadingPositions, positionSlug, positionLabel, selectionChangeRef])

  const sourceReady = activeSource === 'blank'
    || (activeSource === 'sample' && Boolean(selectedPosition))
    || (activeSource === 'previous' && Boolean(selectedCvId))
    || (activeSource === 'upload' && Boolean(uploadFile))
  const canSubmit = sourceReady && (activeSource === 'upload' || previewAvailable)

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

  const clearUpload = () => {
    setUploadFile(null)
    setImportCvId(null)
    setImportError('')
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
      if (activeSource === 'upload') {
        setImportError('')
        const queued = await importCvFile(uploadFile, uploadFile.name, {
          templatePublicId: templateId,
          language: sampleLocale || locale,
          themeColor,
          idempotencyKey: globalThis.crypto?.randomUUID?.() || `import-${Date.now()}`,
          onUploadStateChange: setUploadState,
        })
        setImportCvId(queued.public_id)
        await pollImport(queued.public_id)
        return
      }
      const cv = await createCvFromTemplate({
        title: positionLabel && activeSource === 'sample'
          ? `CV ${positionLabel} - ${template.display_name}`
          : `CV ${template.display_name}`,
        template_public_id: templateId,
        language: activeSource === 'sample' ? sampleLocale : locale,
        ...(themeColor ? { theme_color: themeColor } : {}),
        ...(activeSource === 'sample' ? { position_public_id: selectedPosition } : {}),
        ...(activeSource === 'previous' ? { source_cv_public_id: selectedCvId } : {}),
      })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      if (activeSource === 'upload') {
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
    source: activeSource,
    setSource,
    myCvs: availableCvs,
    selectedCvId,
    setSelectedCvId,
    sampleLocale,
    setSampleLocale,
    positions: positions.items,
    loadingPositions,
    loadingPreview,
    previewError,
    selectedPosition,
    setSelectedPosition,
    submitting,
    uploadFile,
    setUploadFile,
    clearUpload,
    importCvId,
    importError,
    uploadState,
    setImportError,
    canSubmit,
    retryUpload,
    submit,
  }
}
