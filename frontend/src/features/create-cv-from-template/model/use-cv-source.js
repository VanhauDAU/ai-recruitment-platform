// Nghiệp vụ của bảng "Bạn muốn tạo CV từ?" khi tạo CV từ mẫu.
//
// Lựa chọn (`selection`: nguồn, vị trí, mức kinh nghiệm, ngôn ngữ nội dung mẫu)
// do bên ngoài nắm giữ — URL ở trang chi tiết mẫu, state ở hộp "Dùng mẫu" — nên
// hook không có effect khởi tạo/reset nào. Dữ liệu tải bằng TanStack Query:
// preview cũ vẫn hiện trong lúc tải bản mới, dữ liệu đến trễ (phiên đăng nhập,
// danh sách vị trí) tự làm preview hiện ra mà không cần thao tác — lỗi CVT-0.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getMyCvs, importCvFile, retryCvImport, waitForCvImport } from '@/entities/cv'
import { CV_EXPERIENCE_BANDS, CV_LANGUAGES, DEFAULT_CV_EXPERIENCE_BAND, getCvPositionOptions } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { message } from '@/shared/lib/toast'
import { createCvFromTemplate } from '../api/create-cv.api'
import { createCvErrorMessage } from '../api/create-cv.errors'
import { resolvePreviewSelection } from './preview-selection'

export const CV_SOURCES = ['sample', 'previous', 'upload', 'blank']
const POSITIONS_STALE_MS = 10 * 60_000
const PREVIEW_STALE_MS = 5 * 60_000

function importFailureMessage(code) {
  if (code === 'scanned_pdf_ocr_unavailable') return 'PDF là bản scan chưa có lớp chữ. Hãy dùng PDF có thể bôi đen chữ hoặc tệp DOCX.'
  if (code === 'import_timeout') return 'Quá trình phân tích vẫn đang chạy. Bạn có thể thử kiểm tra lại.'
  if (code === 'too_many_pages') return 'CV vượt quá giới hạn 20 trang.'
  return 'Không thể phân tích tệp thành CV. Bạn có thể thử lại hoặc tạo CV trống.'
}

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `cv-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function useCvSource({ template, locale, selection, onSelectionChange, themeColor, onCreated, onRequireLogin }) {
  const { user, isAuthenticated } = useSession()
  const candidateId = isAuthenticated && user?.role === 'candidate' ? user.public_id || 'candidate' : null
  const templateId = template.public_id
  const sampleLocale = selection.sampleLocale || locale
  const experienceBand = selection.experienceBand || DEFAULT_CV_EXPERIENCE_BAND

  const [selectedCvId, setSelectedCvId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [autoCreate, setAutoCreate] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [importCvId, setImportCvId] = useState(null)
  const [importError, setImportError] = useState('')
  const [uploadState, setUploadState] = useState(null)

  const positionsQuery = useQuery({
    queryKey: ['cv-position-options', sampleLocale],
    queryFn: ({ signal }) => getCvPositionOptions(sampleLocale, '', signal),
    staleTime: POSITIONS_STALE_MS,
  })
  const myCvsQuery = useQuery({ queryKey: ['my-cvs', candidateId], queryFn: getMyCvs, enabled: Boolean(candidateId) })
  const positions = positionsQuery.data || []
  const myCvs = candidateId ? myCvsQuery.data || [] : []

  // Chưa chọn hoặc slug không hợp lệ → vị trí đầu tiên.
  const position = positions.find((item) => item.slug === selection.positionSlug) || positions[0] || null
  const cvId = myCvs.some((cv) => cv.public_id === selectedCvId) ? selectedCvId : myCvs[0]?.public_id || null
  // "CV đã tạo" chỉ hợp lệ khi có ít nhất một CV.
  const source = CV_SOURCES.includes(selection.source) && !(selection.source === 'previous' && (!candidateId || (myCvsQuery.isFetched && myCvs.length === 0)))
    ? selection.source
    : 'sample'

  // Slug vị trí trên URL không tồn tại → bỏ khỏi URL (vị trí mặc định không ghi
  // lên URL để trang mặc định giữ canonical, không bị noindex).
  const invalidPositionSlug = positionsQuery.isSuccess && Boolean(selection.positionSlug) && !positions.some((item) => item.slug === selection.positionSlug)
  useEffect(() => {
    if (invalidPositionSlug) onSelectionChange({ positionSlug: null })
  }, [invalidPositionSlug, onSelectionChange])

  const plan = resolvePreviewSelection({
    source,
    locale,
    sampleLocale,
    positionsLocale: positionsQuery.isFetched ? sampleLocale : null,
    positions,
    loadingPositions: positionsQuery.isLoading,
    selectedPosition: position?.public_id || null,
    experienceBand,
    selectedCvId: cvId,
    templatePublicId: templateId,
  })
  const previewQuery = useQuery({
    queryKey: ['cv-template-preview', templateId, source, source === 'sample' ? [position?.public_id, sampleLocale, experienceBand] : null, source === 'previous' ? cvId : null, locale],
    queryFn: ({ signal }) => plan.load(signal),
    enabled: plan.state === 'ready',
    placeholderData: keepPreviousData,
    staleTime: PREVIEW_STALE_MS,
  })
  const preview = {
    document: plan.state === 'ready' ? previewQuery.data?.document || null : null,
    rendererKey: previewQuery.data?.renderer?.key,
    updating: previewQuery.isFetching,
    loading: plan.state === 'waiting' || (plan.state === 'ready' && previewQuery.isPending),
    empty: plan.state === 'empty',
    unavailable: plan.state === 'unavailable',
    error: plan.state === 'ready' && previewQuery.isError,
  }

  const sourceReady = source === 'blank'
    || (source === 'sample' && Boolean(position))
    || (source === 'previous' && Boolean(cvId))
    || (source === 'upload' && Boolean(uploadFile))
  const canSubmit = sourceReady && (source === 'upload' || Boolean(preview.document))

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

  // Một lần bấm = một khóa: bấm lại khi đang gửi bị khóa nút, gửi lại do mạng
  // không tạo CV thứ hai.
  const inFlight = useRef(false)
  const submit = async () => {
    if (inFlight.current) return
    if (!isAuthenticated) {
      // Upload: tệp không giữ được qua đăng nhập nên chỉ mở hộp đăng nhập.
      onRequireLogin?.(() => source !== 'upload' && setAutoCreate(true))
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
    inFlight.current = true
    setSubmitting(true)
    const idempotencyKey = newIdempotencyKey()
    try {
      if (source === 'upload') {
        setImportError('')
        const queued = await importCvFile(uploadFile, uploadFile.name, {
          templatePublicId: templateId,
          language: sampleLocale,
          themeColor,
          idempotencyKey,
          onUploadStateChange: setUploadState,
        })
        setImportCvId(queued.public_id)
        await pollImport(queued.public_id)
        return
      }
      const positionLabel = position?.display_name || position?.name_vi
      const cv = await createCvFromTemplate({
        title: positionLabel && source === 'sample' ? `CV ${positionLabel} – ${template.display_name}` : `CV ${template.display_name}`,
        template_public_id: templateId,
        language: source === 'sample' ? sampleLocale : locale,
        ...(themeColor ? { theme_color: themeColor } : {}),
        ...(source === 'sample' ? { position_public_id: position.public_id, experience_band: experienceBand } : {}),
        ...(source === 'previous' ? { source_cv_public_id: cvId } : {}),
      }, { idempotencyKey })
      message.success('Đã tạo CV. Bạn có thể bắt đầu chỉnh sửa ngay.')
      onCreated?.(cv)
    } catch (error) {
      if (source === 'upload') setImportError(importFailureMessage(error.code))
      else message.error(createCvErrorMessage(error))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  // Đăng nhập xong ngay tại trang (lựa chọn vẫn nằm trên URL): tự bấm Tạo CV một
  // lần khi phiên đã sẵn sàng và bản xem trước đã có.
  const submitRef = useRef(submit)
  useEffect(() => { submitRef.current = submit })
  useEffect(() => {
    if (!autoCreate || !isAuthenticated || !user || !canSubmit) return
    setAutoCreate(false)
    submitRef.current()
  }, [autoCreate, isAuthenticated, user, canSubmit])

  return {
    languages: CV_LANGUAGES,
    experienceBands: CV_EXPERIENCE_BANDS,
    source,
    sampleLocale,
    experienceBand,
    position,
    positions,
    loadingPositions: positionsQuery.isLoading,
    myCvs,
    selectedCvId: cvId,
    setSelectedCvId,
    preview,
    select: onSelectionChange,
    submitting,
    canSubmit,
    submit,
    uploadFile,
    setUploadFile,
    clearUpload,
    importCvId,
    importError,
    setImportError,
    uploadState,
    retryUpload,
  }
}
