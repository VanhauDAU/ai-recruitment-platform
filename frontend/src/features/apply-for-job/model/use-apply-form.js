// Toàn bộ state + nghiệp vụ của form ứng tuyển; UI chỉ compose và render.
import { useEffect, useRef, useState } from 'react'
import { submitJobApplication } from '@/entities/application'
import { getMyCvs, importCvFile } from '@/entities/cv'
import { message } from '@/shared/lib/toast'

export const INITIAL_VISIBLE_CVS = 5
export const UPLOAD_CHOICE_ID = '__upload_from_computer__'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const ERROR_FIELD_LABELS = {
  job_public_id: 'Việc làm',
  cv_public_id: 'CV ứng tuyển',
  version_public_id: 'Phiên bản CV',
  preferred_location_ids: 'Địa điểm làm việc mong muốn',
  data_processing_consent: 'Thỏa thuận sử dụng dữ liệu cá nhân',
  contact_name: 'Họ và tên',
  contact_email: 'Email',
  contact_phone: 'Số điện thoại',
  file: 'Tệp CV',
}

export function requestErrorMessage(error, fallback) {
  const response = error?.response?.data
  if (typeof response?.detail === 'string') return response.detail
  if (!response || typeof response !== 'object' || Array.isArray(response)) return fallback

  const fieldEntry = Object.entries(response).find(([, value]) => (
    (Array.isArray(value) && value.length > 0) || typeof value === 'string'
  ))
  if (!fieldEntry) return fallback

  const [fieldName, rawError] = fieldEntry
  const fieldLabel = ERROR_FIELD_LABELS[fieldName] || fieldName
  const errorText = Array.isArray(rawError) ? rawError[0] : rawError
  if (errorText === 'This field is required.') {
    return `${fieldLabel}: vui lòng nhập thông tin bắt buộc.`
  }
  return fieldName === 'non_field_errors' ? errorText : `${fieldLabel}: ${errorText}`
}

export function useApplyForm({
  open,
  onClose,
  onSubmitted,
  jobPublicId,
  workplaceGroups,
  candidateName,
  candidateEmail,
  candidatePhone,
}) {
  const [cvs, setCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState()
  const [preferredLocationIds, setPreferredLocationIds] = useState([])
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [allowAiAnalysis, setAllowAiAnalysis] = useState(false)
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false)
  const [contactName, setContactName] = useState(candidateName)
  const [contactEmail, setContactEmail] = useState(candidateEmail)
  const [contactPhone, setContactPhone] = useState(candidatePhone)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadedCv, setUploadedCv] = useState(null)
  const [showAllCvs, setShowAllCvs] = useState(false)
  const [loadingCvs, setLoadingCvs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const locationOptions = workplaceGroups.map((group) => ({
    value: group.province_id,
    label: group.province_name,
  }))

  useEffect(() => {
    if (!open) return undefined
    let active = true
    setLoadingCvs(true)
    setError('')
    setCoverLetter('')
    setAllowAiAnalysis(false)
    setDataProcessingConsent(false)
    setLocationDropdownOpen(false)
    setPreferredLocationIds([])
    setContactName(candidateName)
    setContactEmail(candidateEmail)
    setContactPhone(candidatePhone)
    setUploadFile(null)
    setUploadedCv(null)
    setShowAllCvs(false)
    getMyCvs()
      .then((items) => {
        if (!active) return
        setCvs(items)
        const initial = items.find((cv) => cv.is_default) || items[0]
        setSelectedCvId(initial?.public_id || UPLOAD_CHOICE_ID)
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách CV. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoadingCvs(false)
      })
    return () => { active = false }
  }, [open, jobPublicId, candidateName, candidateEmail, candidatePhone])

  function selectUploadFile(file) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx'].includes(extension) || file.size > MAX_UPLOAD_BYTES) {
      setError('CV tải lên phải là tệp PDF hoặc DOCX và không vượt quá 5MB.')
      return
    }
    setError('')
    setUploadFile(file)
    setUploadedCv(null)
    setSelectedCvId(UPLOAD_CHOICE_ID)
  }

  function handleUploadInput(event) {
    selectUploadFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    selectUploadFile(event.dataTransfer.files?.[0])
  }

  async function submit() {
    const isUploadChoice = selectedCvId === UPLOAD_CHOICE_ID
    let targetCv = cvs.find((cv) => cv.public_id === selectedCvId)
    if (isUploadChoice && !uploadFile && !uploadedCv) return
    if (!isUploadChoice && !targetCv?.latest_version_public_id) return
    if (isUploadChoice && (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim())) return
    if (!dataProcessingConsent) return

    setSubmitting(true)
    setError('')
    try {
      if (isUploadChoice) {
        targetCv = uploadedCv
        if (!targetCv) {
          setUploading(true)
          targetCv = await importCvFile(uploadFile, uploadFile.name)
          setUploadedCv(targetCv)
          setUploading(false)
        }
      }
      const application = await submitJobApplication({
        jobPublicId,
        cvPublicId: targetCv.public_id,
        versionPublicId: targetCv.latest_version_public_id,
        coverLetter: coverLetter.trim(),
        preferredLocationIds,
        allowAiAnalysis,
        dataProcessingConsent,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      })
      message.success('Đã gửi hồ sơ ứng tuyển.')
      onSubmitted?.(application)
      onClose()
    } catch (requestError) {
      setError(requestErrorMessage(
        requestError,
        isUploadChoice
          ? 'Không thể tải CV hoặc gửi hồ sơ. Vui lòng thử lại.'
          : 'Không thể gửi hồ sơ ứng tuyển. Vui lòng thử lại.',
      ))
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  const visibleCvs = showAllCvs ? cvs : cvs.slice(0, INITIAL_VISIBLE_CVS)
  const selectedCv = cvs.find((cv) => cv.public_id === selectedCvId)
  const isUploadChoice = selectedCvId === UPLOAD_CHOICE_ID
  const needsLocation = locationOptions.length > 0
  const contactComplete = Boolean(contactName.trim() && contactEmail.trim() && contactPhone.trim())
  const cvReady = isUploadChoice
    ? Boolean((uploadFile || uploadedCv) && contactComplete)
    : Boolean(selectedCv?.latest_version_public_id)
  const selectionReady = Boolean(
    cvReady
    && (!needsLocation || preferredLocationIds.length > 0)
    && dataProcessingConsent,
  )

  return {
    cvs,
    visibleCvs,
    selectedCvId,
    setSelectedCvId,
    isUploadChoice,
    preferredLocationIds,
    setPreferredLocationIds,
    locationDropdownOpen,
    setLocationDropdownOpen,
    locationOptions,
    needsLocation,
    coverLetter,
    setCoverLetter,
    allowAiAnalysis,
    setAllowAiAnalysis,
    dataProcessingConsent,
    setDataProcessingConsent,
    contactName,
    setContactName,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    uploadFile,
    setUploadFile,
    setUploadedCv,
    showAllCvs,
    setShowAllCvs,
    loadingCvs,
    uploading,
    submitting,
    error,
    setError,
    fileInputRef,
    handleUploadInput,
    handleDrop,
    submit,
    selectionReady,
  }
}
