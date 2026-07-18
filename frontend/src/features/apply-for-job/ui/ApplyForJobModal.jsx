import {
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  FileTextOutlined,
  FolderFilled,
  FormOutlined,
  InfoCircleFilled,
  SafetyCertificateOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Alert, Button, Checkbox, Input, Modal, Select, Spin, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { submitJobApplication } from '@/entities/application'
import { getMyCvs, importCvFile } from '@/entities/cv'
import { settingText, useSiteSettings } from '@/entities/site-settings'

const INITIAL_VISIBLE_CVS = 5
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const UPLOAD_CHOICE_ID = '__upload_from_computer__'
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

function formatCvDate(value) {
  if (!value) return 'Chưa có thời gian cập nhật'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function requestErrorMessage(error, fallback) {
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

function CvChoice({ cv, selected, onSelect }) {
  const canEdit = cv.cv_type !== 'uploaded' && cv.is_complete === false
  const statusText = cv.has_unsaved_changes
    ? 'Chưa lưu'
    : cv.is_complete === false
      ? 'CV chưa hoàn thiện'
      : ''

  return (
    <div
      onClick={() => onSelect(cv.public_id)}
      className={[
        'group flex min-h-[60px] cursor-pointer items-center gap-3 rounded-md border px-4 py-2.5 transition',
        selected
          ? 'border-slate-300 bg-slate-50/50'
          : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <input
        type="radio"
        name="application-cv"
        value={cv.public_id}
        checked={selected}
        onChange={() => onSelect(cv.public_id)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${cv.title}${cv.is_default ? ' CV chính' : ''}`}
        className="h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-5 text-slate-700">{cv.title}</span>
        <span className="block text-sm italic leading-5 text-slate-400">
          {cv.cv_type === 'uploaded' ? 'CV tải lên' : 'CV online'} - {formatCvDate(cv.updated_at)}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {statusText && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fde1dc] px-2.5 py-1 text-xs font-medium text-[#d83a2e]">
            <InfoCircleFilled /> {statusText}
          </span>
        )}
        {canEdit && (
          <Link
            to={`/cvs/${cv.public_id}/edit`}
            target="_blank"
            onClick={(event) => event.stopPropagation()}
            className="rounded-full bg-[var(--brand-primary)] px-4 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Sửa CV
          </Link>
        )}
        {!canEdit && (
          <Link
            to={`/cvs/${cv.public_id}/view`}
            target="_blank"
            onClick={(event) => event.stopPropagation()}
            className="pointer-events-none rounded-md px-2 py-1 text-xs font-medium text-slate-400 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:text-[var(--brand-primary)]"
          >
            <EyeOutlined /> Xem
          </Link>
        )}
      </span>
    </div>
  )
}

function RequiredLabel({ children }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-700">
      {children} <span className="text-rose-500">*</span>
    </span>
  )
}

function UploadChoice({
  selected,
  uploading,
  file,
  onSelect,
  onChooseFile,
  onDeleteFile,
  onDrop,
  contactName,
  contactEmail,
  contactPhone,
  onContactNameChange,
  onContactEmailChange,
  onContactPhoneChange,
}) {
  return (
    <div
      onClick={onSelect}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="cursor-pointer rounded-md border border-dashed border-slate-300 px-4 py-4"
    >
      <div className="grid grid-cols-[24px_minmax(0,1fr)_24px] items-start gap-2">
        <input
          type="radio"
          name="application-cv"
          value={UPLOAD_CHOICE_ID}
          checked={selected}
          onChange={onSelect}
          onClick={(event) => event.stopPropagation()}
          aria-label="Tải CV từ máy tính"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
        />
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3">
            {uploading
              ? <Spin size="small" />
              : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-400"><UploadOutlined /></span>}
            <span className="text-sm font-semibold text-slate-800">
              Tải CV từ máy tính, chọn hoặc kéo thả
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">Hỗ trợ định dạng PDF, DOCX có kích thước dưới 5MB</p>
          <Button
            disabled={uploading}
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
              onChooseFile()
            }}
            className="mt-2 !border-0 !bg-slate-100 !px-7 !font-semibold !text-slate-700 hover:!bg-slate-200"
          >
            Chọn CV
          </Button>
        </div>
        <span />
      </div>

      {selected && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {file && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <FileTextOutlined className="text-xl text-[var(--brand-primary)]" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand-primary)]">
                {file.name}
              </span>
              <button
                type="button"
                aria-label="Xóa CV tải lên"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteFile()
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100"
              >
                <DeleteOutlined />
              </button>
              <Button
                onClick={(event) => {
                  event.stopPropagation()
                  onChooseFile()
                }}
                className="!border-0 !bg-slate-100 !font-semibold !text-slate-700 hover:!bg-slate-200"
              >
                Chọn CV khác
              </Button>
            </div>
          )}

          <div className={file ? 'pt-3' : ''}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--brand-primary)]">
                Vui lòng nhập đầy đủ thông tin chi tiết:
              </p>
              <p className="text-xs text-rose-500">(*) Thông tin bắt buộc.</p>
            </div>

            <label className="block">
              <RequiredLabel>Họ và tên</RequiredLabel>
              <Input
                size="large"
                aria-label="Họ và tên ứng tuyển"
                value={contactName}
                onChange={(event) => onContactNameChange(event.target.value)}
                placeholder="Họ tên hiển thị với Nhà tuyển dụng"
                className="!rounded-lg"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <RequiredLabel>Email</RequiredLabel>
                <Input
                  size="large"
                  type="email"
                  aria-label="Email ứng tuyển"
                  value={contactEmail}
                  onChange={(event) => onContactEmailChange(event.target.value)}
                  placeholder="Email hiển thị với Nhà tuyển dụng"
                  className="!rounded-lg"
                />
              </label>
              <label>
                <RequiredLabel>Số điện thoại</RequiredLabel>
                <Input
                  size="large"
                  aria-label="Số điện thoại ứng tuyển"
                  value={contactPhone}
                  onChange={(event) => onContactPhoneChange(event.target.value)}
                  placeholder="Số điện thoại hiển thị với Nhà tuyển dụng"
                  className="!rounded-lg"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApplyForJobModal({
  open,
  onClose,
  onSubmitted,
  jobPublicId,
  jobTitle,
  workplaceGroups = [],
  candidateName = '',
  candidateEmail = '',
  candidatePhone = '',
}) {
  const { settings } = useSiteSettings()
  const supportEmail = settingText(settings.support_email, 'support@procv.vn')
  const siteName = settingText(settings.site_name, 'ProCV')
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
      await submitJobApplication({
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
      onSubmitted?.()
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

  return (
    <Modal
      title={(
        <div className="pr-8">
          <h2 className="text-xl font-bold text-slate-900">Ứng tuyển</h2>
          {jobTitle && <p className="mt-0.5 truncate text-sm font-normal text-slate-500">{jobTitle}</p>}
        </div>
      )}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={null}
      width={650}
      centered
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 8, overflow: 'hidden', padding: 0 },
        header: { padding: '20px 32px 16px', margin: 0, borderBottom: '1px solid #f1f2f4' },
      }}
    >
      <div className="max-h-[min(72vh,820px)] overflow-y-auto bg-white px-8 py-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
        {error && <Alert type="error" showIcon title={error} closable onClose={() => setError('')} className="mb-4" />}

        <section aria-labelledby="application-cv-heading">
          <h3 id="application-cv-heading" className="flex items-center gap-2 text-base font-bold text-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--brand-primary)] text-xs text-white">
              <FolderFilled />
            </span>
            Chọn CV để ứng tuyển
          </h3>

          <div className="mt-3 space-y-2.5" role="radiogroup" aria-label="CV ứng tuyển">
            {loadingCvs ? (
              <div className="flex justify-center py-10"><Spin /></div>
            ) : (
              visibleCvs.map((cv) => (
                <CvChoice
                  key={cv.public_id}
                  cv={cv}
                  selected={cv.public_id === selectedCvId}
                  onSelect={setSelectedCvId}
                />
              ))
            )}
          </div>

          {cvs.length > INITIAL_VISIBLE_CVS && (
            <button
              type="button"
              onClick={() => setShowAllCvs((current) => !current)}
              className="mt-9 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-100 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            >
              {showAllCvs ? 'Thu gọn' : 'Xem thêm'} <DownOutlined className={showAllCvs ? 'rotate-180' : ''} />
            </button>
          )}

        </section>

        <section className="mt-5" aria-label="Tải CV từ máy tính">
          <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleUploadInput} />
          <UploadChoice
            selected={isUploadChoice}
            uploading={uploading}
            file={uploadFile}
            onSelect={() => setSelectedCvId(UPLOAD_CHOICE_ID)}
            onChooseFile={() => fileInputRef.current?.click()}
            onDeleteFile={() => {
              setUploadFile(null)
              setUploadedCv(null)
            }}
            onDrop={handleDrop}
            contactName={contactName}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            onContactNameChange={setContactName}
            onContactEmailChange={setContactEmail}
            onContactPhoneChange={setContactPhone}
          />
        </section>

        {needsLocation && (
          <section className="mt-3" aria-labelledby="preferred-location-heading">
            <h3 id="preferred-location-heading" className="text-sm font-bold text-slate-700">
              Địa điểm làm việc mong muốn <span className="text-rose-500">*</span>
            </h3>
            <Select
              mode="multiple"
              size="large"
              aria-label="Địa điểm làm việc mong muốn"
              className="mt-2 w-full"
              value={preferredLocationIds}
              onChange={setPreferredLocationIds}
              open={locationDropdownOpen}
              onOpenChange={setLocationDropdownOpen}
              onSelect={() => setLocationDropdownOpen(false)}
              options={locationOptions}
              maxTagCount="responsive"
              placeholder="Chọn địa điểm"
            />
          </section>
        )}

        <section className="mt-5" aria-labelledby="cover-letter-heading">
          <h3 id="cover-letter-heading" className="flex items-center gap-2 text-lg font-bold text-slate-700">
            <FormOutlined className="text-xl text-[var(--brand-primary)]" />
            Thư giới thiệu:
          </h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            Một thư giới thiệu ngắn gọn, chỉn chu sẽ giúp bạn trở nên chuyên nghiệp và gây ấn tượng hơn với nhà tuyển dụng.
          </p>
          <Input.TextArea
            aria-label="Thư giới thiệu"
            className="mt-2 !rounded-xl"
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
            maxLength={10000}
            showCount
            rows={4}
            placeholder="Viết giới thiệu ngắn gọn về bản thân (điểm mạnh, điểm yếu) và nêu rõ mong muốn, lý do bạn muốn ứng tuyển cho vị trí này."
          />
        </section>

        <section className="mt-5 border-t border-slate-100 pt-5" aria-labelledby="application-notice-heading">
          <p id="application-notice-heading" className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <SafetyCertificateOutlined className="text-rose-500" /> Lưu ý
          </p>
          <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3">
              <ExclamationCircleFilled className="mt-1 shrink-0 text-rose-500" />
              <span>
                <strong className="text-slate-800">1.</strong> {siteName} khuyên tất cả các bạn hãy luôn cẩn trọng trong quá trình tìm việc và chủ động nghiên cứu thông tin công ty, vị trí việc làm trước khi ứng tuyển.
              </span>
            </li>
            <li className="flex gap-3">
              <ExclamationCircleFilled className="mt-1 shrink-0 text-rose-500" />
              <span>
                <strong className="text-slate-800">2.</strong> Ứng viên cần có trách nhiệm với hành vi ứng tuyển của mình. Nếu gặp tin tuyển dụng hoặc liên hệ đáng ngờ của Nhà tuyển dụng, hãy báo cáo ngay cho {siteName} qua email{' '}
                <a href={`mailto:${supportEmail}`} className="font-semibold text-[var(--brand-primary)] underline">{supportEmail}</a>{' '}
                để được hỗ trợ kịp thời.
              </span>
            </li>
          </ol>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-3 space-y-2.5 text-sm text-slate-700">
          <Checkbox checked={allowAiAnalysis} onChange={(event) => setAllowAiAnalysis(event.target.checked)}>
            Cho phép {siteName} sử dụng <span className="underline">công nghệ AI</span> để phân tích độ phù hợp CV của bạn
          </Checkbox>
          <Checkbox
            checked={dataProcessingConsent}
            onChange={(event) => setDataProcessingConsent(event.target.checked)}
          >
            Tôi đã đọc và đồng ý với <span className="underline">&quot;Thỏa thuận sử dụng dữ liệu cá nhân&quot;</span> của Nhà tuyển dụng
            <span className="text-rose-500"> *</span>
          </Checkbox>
        </div>
        <Button
          block
          type="primary"
          size="large"
          loading={submitting}
          disabled={!selectionReady}
          onClick={submit}
          className="!h-10 !rounded-md !border-[var(--brand-primary)] !bg-[var(--brand-primary)] !font-bold hover:!border-[var(--brand-primary-hover)] hover:!bg-[var(--brand-primary-hover)]"
        >
          Nộp hồ sơ ứng tuyển
        </Button>
      </div>
    </Modal>
  )
}
