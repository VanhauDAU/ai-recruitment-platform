import { BankOutlined, CameraOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Col, Form, Image, Input, Modal, Radio, Row, Select, Upload } from 'antd'
import { useMemo, useRef, useState } from 'react'
import {
  createEmployerCompany,
  createEmployerCompanyUpdateRequest,
  employerProfileKeys,
  getEmployerCompanyDocuments,
  saveEmployerCompanyTradeNameWebsite,
  uploadEmployerCompanyDocument,
  uploadEmployerCompanyImage,
  uploadEmployerCompanyLogo,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import RichTextEditor from '@/shared/ui/RichTextEditor'
import { buildCompanyChanges, companyToForm, DEFAULT_COMPANY_FORM, validateCompanyImage } from '../model/company-form'

const TAX_LOOKUP_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

function EditorField(props) {
  const { status } = Form.Item.useStatus()
  return <RichTextEditor {...props} error={status === 'error'} />
}

function uploadProps(setFile) {
  return {
    maxCount: 1,
    accept: '.jpg,.jpeg,.png,.pdf',
    beforeUpload: (file) => { setFile(file); return false },
    onRemove: () => setFile(null),
  }
}

function validateTradeNameProof(file) {
  const extension = file?.name?.split('.').pop()?.toLowerCase()
  if (!['jpeg', 'jpg', 'png', 'pdf'].includes(extension)) return 'Chỉ chấp nhận tệp .jpeg, .jpg, .png hoặc .pdf.'
  if (file.size > 5 * 1024 * 1024) return 'Dung lượng tệp tối đa là 5 MB.'
  return null
}

function isWebsiteUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

export default function CompanyForm({ catalogs, industries, disabled, company = null, pendingRequest = null, canManageMedia = true, onCompleted, onCancel }) {
  const isEdit = Boolean(company)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [logoFile, setLogoFile] = useState(null)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [galleryDeletionIds, setGalleryDeletionIds] = useState(
    () => pendingRequest?.changes?.gallery_deletions || [],
  )
  const [pendingTradeProof, setPendingTradeProof] = useState(null)
  const [isTradeProofModalOpen, setTradeProofModalOpen] = useState(false)
  const [tradeProofSource, setTradeProofSource] = useState('file')
  const [tradeProofDraftFile, setTradeProofDraftFile] = useState(null)
  const [tradeProofDraftWebsite, setTradeProofDraftWebsite] = useState('')
  const [businessProofFile, setBusinessProofFile] = useState(null)
  const [authorizationFile, setAuthorizationFile] = useState(null)
  const [identityFile, setIdentityFile] = useState(null)
  const [isSensitiveModalOpen, setSensitiveModalOpen] = useState(false)
  const [pendingSubmitValues, setPendingSubmitValues] = useState(null)
  const websiteBackup = useRef(company?.website_url || '')
  const tradeNameBackup = useRef(company?.trade_name || '')
  const initialValues = useMemo(
    () => company ? companyToForm(company, pendingRequest?.changes) : DEFAULT_COMPANY_FORM,
    [company, pendingRequest?.changes],
  )
  const businessType = Form.useWatch('business_type', form) || initialValues.business_type
  const selectedIndustries = Form.useWatch('industries', form) || []
  const hasNoWebsite = Form.useWatch('has_no_website', form) ?? initialValues.has_no_website
  const hasNoLogo = Form.useWatch('has_no_logo', form) ?? initialValues.has_no_logo
  const sameTradeName = Form.useWatch('trade_name_same_as_registered', form) ?? initialValues.trade_name_same_as_registered
  const watchedName = Form.useWatch('company_name', form) ?? initialValues.company_name
  const watchedTax = Form.useWatch('tax_code', form) ?? initialValues.tax_code
  const proofType = Form.useWatch('proof_type', form) || pendingRequest?.proof_type || 'business_registration'
  const isSensitive = isEdit && (watchedName !== company.company_name || watchedTax !== company.tax_code)
  const pendingLogoUrl = pendingRequest?.media_previews?.logo_url || ''
  const pendingGalleryUrls = pendingRequest?.media_previews?.gallery_additions || []
  const visibleCompanyImages = (company?.images || []).filter(
    (image) => !galleryDeletionIds.includes(image.id),
  )
  const galleryItemCount = visibleCompanyImages.length + pendingGalleryUrls.length + galleryFiles.length
  const industryOptions = industries.map((item) => ({ value: item.id, label: item.name }))
  const selectedIndustryOptions = industryOptions.filter((item) => selectedIndustries.includes(item.value))
  const documentsQuery = useQuery({
    queryKey: employerProfileKeys.companyDocuments,
    queryFn: getEmployerCompanyDocuments,
    enabled: isEdit,
  })
  const savedTradeProof = useMemo(() => (documentsQuery.data || []).find((item) => item.doc_type === 'trade_name_proof') || null, [documentsQuery.data])
  const currentTradeProof = pendingTradeProof || savedTradeProof
  const documentsRequiringReplacement = useMemo(
    () => (pendingRequest?.documents || []).filter((document) => (
      document.is_current && ['changes_requested', 'rejected'].includes(document.status)
    )),
    [pendingRequest?.documents],
  )
  const replacementProofTypes = useMemo(
    () => new Set(documentsRequiringReplacement.map((document) => document.doc_type)),
    [documentsRequiringReplacement],
  )
  const retainedProofTypes = useMemo(
    () => new Set((pendingRequest?.documents || [])
      .filter((document) => (
        document.is_current && !['changes_requested', 'rejected'].includes(document.status)
      ))
      .map((document) => document.doc_type)),
    [pendingRequest?.documents],
  )

  const saveMutation = useMutation({
    mutationFn: save,
    onSuccess: async ({ partialFailures = [] }) => {
      setSensitiveModalOpen(false)
      setPendingSubmitValues(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employerProfileKeys.company }),
        queryClient.invalidateQueries({ queryKey: ['employer', 'profile'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
      ])
      if (partialFailures.length) {
        message.warning(`Thông tin công ty đã được lưu, nhưng ${partialFailures.length} tệp chưa tải lên thành công. Bạn có thể mở Chỉnh sửa để thử lại.`)
      } else {
        message.success(isEdit ? 'Đã gửi yêu cầu cập nhật thông tin công ty.' : 'Đã tạo và liên kết hồ sơ công ty.')
      }
      await onCompleted?.()
    },
    onError: (error) => message.error(getApiErrorMessage(error, isEdit ? 'Không thể gửi yêu cầu cập nhật.' : 'Không thể tạo hồ sơ công ty.')),
  })
  const mediaDisabled = disabled || saveMutation.isPending || !canManageMedia

  async function save(values) {
    const {
      update_reason: reason,
      proof_type: sensitiveProofType,
      ...formValues
    } = values
    const normalized = {
      ...formValues,
      website_url: formValues.has_no_website ? '' : formValues.website_url,
      trade_name: formValues.trade_name_same_as_registered ? formValues.company_name : formValues.trade_name,
      employee_benefits: formValues.employee_benefits || '',
    }
    let updateRequest = null
    if (isEdit) {
      const changes = buildCompanyChanges(normalized, company)
      if (logoFile) changes.logo_pending = true
      if (galleryFiles.length) changes.gallery_pending = true
      if (galleryDeletionIds.length) changes.gallery_deletions = galleryDeletionIds
      if (Object.keys(changes).length) {
        updateRequest = await createEmployerCompanyUpdateRequest({
          changes,
          reason: isSensitive ? reason : '',
          proof_type: isSensitive ? sensitiveProofType : '',
        })
      }
    } else {
      await createEmployerCompany({
        ...normalized,
        logo_pending: Boolean(logoFile),
      })
    }

    const uploads = []
    if (logoFile) uploads.push(uploadEmployerCompanyLogo(logoFile, { updateRequest: updateRequest?.public_id }))
    for (const file of galleryFiles) uploads.push(uploadEmployerCompanyImage(file, { updateRequest: updateRequest?.public_id }))
    if (pendingTradeProof?.source_type === 'file') uploads.push(uploadEmployerCompanyDocument('trade_name_proof', pendingTradeProof.file, { updateRequest: updateRequest?.public_id }))
    if (pendingTradeProof?.source_type === 'website') uploads.push(saveEmployerCompanyTradeNameWebsite(pendingTradeProof.file_url, { updateRequest: updateRequest?.public_id }))
    if (isSensitive && updateRequest) {
      if (sensitiveProofType === 'business_registration') {
        if (businessProofFile) uploads.push(uploadEmployerCompanyDocument('business_registration', businessProofFile, { updateRequest: updateRequest.public_id }))
      } else {
        if (authorizationFile) uploads.push(uploadEmployerCompanyDocument('authorization_letter', authorizationFile, { updateRequest: updateRequest.public_id }))
        if (identityFile) uploads.push(uploadEmployerCompanyDocument('identity_document', identityFile, { updateRequest: updateRequest.public_id }))
      }
    }
    const results = await Promise.allSettled(uploads)
    return { partialFailures: results.filter((item) => item.status === 'rejected') }
  }

  function addGalleryFiles(files) {
    const available = Math.max(
      0,
      10 - (company?.images?.length || 0) + galleryDeletionIds.length - galleryFiles.length,
    )
    const valid = []
    for (const file of files.slice(0, available)) {
      const error = validateCompanyImage(file)
      if (error) message.error(`${file.name}: ${error}`)
      else valid.push(file)
    }
    if (files.length > available) message.warning('Thư viện công ty chỉ được có tối đa 10 ảnh.')
    setGalleryFiles((current) => [...current, ...valid])
    return false
  }

  function changeNoWebsite(event) {
    const checked = event.target.checked
    if (checked) {
      websiteBackup.current = form.getFieldValue('website_url') || websiteBackup.current
      form.setFieldValue('website_url', '')
    } else {
      form.setFieldValue('website_url', websiteBackup.current)
    }
  }

  function changeSameTradeName(event) {
    const checked = event.target.checked
    if (checked) {
      tradeNameBackup.current = form.getFieldValue('trade_name') || tradeNameBackup.current
      form.setFieldValue('trade_name', form.getFieldValue('company_name') || '')
    } else {
      form.setFieldValue('trade_name', tradeNameBackup.current)
    }
  }

  function validateSensitiveProof() {
    if (!isSensitive) return Promise.resolve()
    const retainsSameProof = proofType === pendingRequest?.proof_type
    if (
      proofType === 'business_registration'
      && !businessProofFile
      && !(retainsSameProof && retainedProofTypes.has('business_registration'))
    ) return Promise.reject(new Error('Chọn giấy đăng ký doanh nghiệp.'))
    if (
      proofType === 'authorization_and_id'
      && (
        (!authorizationFile && !(retainsSameProof && retainedProofTypes.has('authorization_letter')))
        || (!identityFile && !(retainsSameProof && retainedProofTypes.has('identity_document')))
      )
    ) return Promise.reject(new Error('Chọn đủ giấy ủy quyền và giấy tờ định danh.'))
    return Promise.resolve()
  }

  function submitCompanyForm(values) {
    if (isSensitive) {
      setPendingSubmitValues(values)
      setSensitiveModalOpen(true)
      return
    }
    saveMutation.mutate(values)
  }

  function openRequestedProofUpload() {
    if (replacementProofTypes.has('trade_name_proof')) {
      openTradeProofModal()
      return
    }
    setPendingSubmitValues(form.getFieldsValue(true))
    setSensitiveModalOpen(true)
  }

  async function confirmSensitiveSubmit() {
    try {
      const proofValues = await form.validateFields(['update_reason', 'proof_type'])
      saveMutation.mutate({ ...pendingSubmitValues, ...proofValues })
    } catch {
      // Ant Design renders field-level validation feedback in the modal.
    }
  }

  function openTradeProofModal() {
    const proof = currentTradeProof
    setTradeProofSource(proof?.source_type || 'file')
    setTradeProofDraftFile(pendingTradeProof?.source_type === 'file' ? pendingTradeProof.file : null)
    setTradeProofDraftWebsite(proof?.source_type === 'website' ? proof.file_url : '')
    setTradeProofModalOpen(true)
  }

  function saveTradeProof() {
    if (tradeProofSource === 'file') {
      const error = validateTradeNameProof(tradeProofDraftFile)
      if (error) {
        message.error(error || 'Chọn giấy tờ chứng minh tên thương mại.')
        return
      }
      setPendingTradeProof({
        source_type: 'file',
        file: tradeProofDraftFile,
        file_url: URL.createObjectURL(tradeProofDraftFile),
        file_name: 'Giấy tờ thương mại',
      })
    } else {
      const websiteUrl = tradeProofDraftWebsite.trim()
      if (!isWebsiteUrl(websiteUrl)) {
        message.error('Nhập URL Website hợp lệ, bắt đầu bằng http:// hoặc https://.')
        return
      }
      setPendingTradeProof({ source_type: 'website', file_url: websiteUrl, file_name: websiteUrl })
    }
    setTradeProofModalOpen(false)
  }

  function stageExistingImageDeletion(imageId) {
    setGalleryDeletionIds((current) => (
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    ))
  }

  const entityLabel = businessType === 'household' ? 'hộ kinh doanh' : 'công ty'
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        ...initialValues,
        update_reason: pendingRequest?.reason || '',
        proof_type: pendingRequest?.proof_type || 'business_registration',
      }}
      disabled={disabled || saveMutation.isPending}
      onFinish={submitCompanyForm}
      onFinishFailed={({ errorFields }) => errorFields[0] && form.scrollToField(errorFields[0].name, { behavior: 'smooth', block: 'center' })}
      requiredMark={false}
      className="company-form"
    >
      {isEdit && <header className="company-form-intro"><h2>Cập nhật thông tin công ty</h2><p>Thông tin này sẽ hiển thị với ứng viên trên tin tuyển dụng của bạn.</p></header>}
      {documentsRequiringReplacement.length > 0 && (
        <Alert
          className="company-form-document-request"
          type="warning"
          showIcon
          title="Yêu cầu này cần bổ sung giấy tờ"
          description={(
            <div className="company-form-document-request__content">
              {documentsRequiringReplacement.map((document) => (
                <p key={document.public_id || document.id}>
                  <strong>{document.doc_type_label || document.doc_type}:</strong>{' '}
                  {document.review_note || 'Vui lòng tải lên bản mới.'}
                </p>
              ))}
              <Button type="primary" aria-label="Chọn giấy tờ thay thế" icon={<UploadOutlined />} onClick={openRequestedProofUpload}>
                Chọn giấy tờ thay thế
              </Button>
            </div>
          )}
        />
      )}
      <section className="company-logo-section">
        <div className="company-logo-control">
          <Upload disabled={mediaDisabled} showUploadList={false} accept=".jpg,.jpeg,.png,.webp" beforeUpload={(file) => {
              const error = validateCompanyImage(file)
              if (error) message.error(error)
              else { setLogoFile(file); form.setFieldValue('has_no_logo', false) }
              return false
            }}>
            <button type="button" className="company-logo-upload" aria-label="Chọn logo" title="JPG, PNG hoặc WebP tối đa 5 MB" disabled={mediaDisabled}>
              {(logoFile || pendingLogoUrl || company?.logo_url) && !hasNoLogo
                ? <img className="company-logo-preview" src={logoFile ? URL.createObjectURL(logoFile) : pendingLogoUrl || company.logo_url} alt={`Logo ${entityLabel}`} />
                : <span className="company-logo-placeholder"><BankOutlined /><span className="company-logo-placeholder__camera"><CameraOutlined /></span></span>}
            </button>
          </Upload>
          <h2 className="company-logo-title">Logo {entityLabel} <span className="company-required">*</span></h2>
          <Form.Item name="has_no_logo" valuePropName="checked" className="!mb-0"><Checkbox disabled={mediaDisabled} onChange={(event) => event.target.checked && setLogoFile(null)}>Tôi không có logo</Checkbox></Form.Item>
        </div>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">Thông tin pháp lý</h2>
        <Form.Item name="business_type" label={<RequiredLabel>Loại hình kinh doanh</RequiredLabel>} rules={[{ required: true, message: 'Chọn loại hình kinh doanh.' }]}>
          <Radio.Group className="company-business-type">
            {(catalogs.business_types || []).map((item) => <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>)}
          </Radio.Group>
        </Form.Item>
        <Alert
          className="company-tax-alert"
          type="info"
          showIcon
          title={businessType === 'household' ? 'Nhập thông tin đúng với đăng ký thuế của người đại diện hộ kinh doanh.' : 'Nhập đúng tên và mã số thuế trên Giấy chứng nhận đăng ký doanh nghiệp.'}
          description={<a href={TAX_LOOKUP_URL} target="_blank" rel="noreferrer" className="company-setting-link">Tra cứu thông tin tại Cục Thuế</a>}
        />
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}><Form.Item name="tax_code" label={<RequiredLabel>{businessType === 'household' ? 'Mã số thuế người đại diện' : 'Mã số thuế'}</RequiredLabel>} rules={[{ required: true, message: 'Nhập mã số thuế.' }, { pattern: /^\d{10}(-\d{3})?$/, message: 'Nhập 10 chữ số hoặc dạng 10 chữ số-3 chữ số.' }]}><Input size="large" placeholder="0101234567" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="company_name" label={<RequiredLabel>{businessType === 'household' ? 'Tên hộ kinh doanh' : 'Tên công ty'}</RequiredLabel>} rules={[{ required: true, whitespace: true, message: `Nhập tên ${entityLabel}.` }]}><Input size="large" onChange={(event) => sameTradeName && form.setFieldValue('trade_name', event.target.value)} /></Form.Item></Col>
          <Col span={24}><Form.Item name="trade_name_same_as_registered" valuePropName="checked"><Checkbox onChange={changeSameTradeName}>Tên thương mại trùng với tên đăng ký kinh doanh</Checkbox></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="trade_name" label={<RequiredLabel>Tên thương mại</RequiredLabel>} rules={[{ required: !sameTradeName, whitespace: true, message: 'Nhập tên thương mại.' }]}><Input size="large" disabled={sameTradeName} /></Form.Item></Col>
          {!sameTradeName && <Col xs={24} md={12}>
            <Form.Item>
              {currentTradeProof ? (
                <div className="company-trade-proof">
                  <a href={currentTradeProof.file_url} target="_blank" rel="noreferrer" className="company-setting-link" title={currentTradeProof.source_type === 'website' ? currentTradeProof.file_url : 'Mở giấy tờ thương mại'}>
                    <LinkOutlined /> {currentTradeProof.source_type === 'website' ? currentTradeProof.file_url : 'Giấy tờ thương mại'}
                  </a>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={openTradeProofModal}>Chỉnh sửa</Button>
                </div>
              ) : <Button type="link" icon={<PlusOutlined />} className="company-trade-proof__add" onClick={openTradeProofModal}>Thêm giấy tờ chứng minh Tên thương mại</Button>}
            </Form.Item>
          </Col>}
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">Thông tin hoạt động</h2>
        <Row gutter={[16, 0]}>
          <Col span={24}><Form.Item name="industries" label={<RequiredLabel>Lĩnh vực hoạt động</RequiredLabel>} rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một lĩnh vực.' }]}><Select mode="multiple" size="large" showSearch optionFilterProp="label" options={industryOptions} placeholder="Chọn một hoặc nhiều lĩnh vực" onChange={(values) => !values.includes(form.getFieldValue('primary_industry')) && form.setFieldValue('primary_industry', undefined)} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="primary_industry" label={<RequiredLabel>Lĩnh vực chính</RequiredLabel>} rules={[{ required: true, message: 'Chọn lĩnh vực chính.' }]}><Select size="large" disabled={!selectedIndustries.length} options={selectedIndustryOptions} placeholder={selectedIndustries.length ? 'Chọn từ lĩnh vực đã chọn' : 'Chọn lĩnh vực hoạt động trước'} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="company_size" label={<RequiredLabel>Quy mô công ty</RequiredLabel>} rules={[{ required: true, message: 'Chọn quy mô công ty.' }]}><Select size="large" options={catalogs.company_sizes || []} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="markets" label="Thị trường hoạt động"><Select mode="multiple" size="large" options={catalogs.markets || []} placeholder="Chọn thị trường" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="target_customers" label="Khách hàng mục tiêu"><Select mode="multiple" size="large" options={catalogs.target_customers || []} placeholder="Chọn nhóm khách hàng" /></Form.Item></Col>
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">Thông tin liên hệ</h2>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}><Form.Item name="email" label={<RequiredLabel>Email công ty</RequiredLabel>} rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ.' }]}><Input size="large" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="phone" label={<RequiredLabel>Số điện thoại</RequiredLabel>} rules={[{ required: true, message: 'Nhập số điện thoại.' }, { pattern: /^\+?[0-9 .()-]{8,20}$/, message: 'Số điện thoại không hợp lệ.' }]}><Input size="large" /></Form.Item></Col>
          <Col span={24}><Form.Item name="address" label={<RequiredLabel>Địa chỉ</RequiredLabel>} rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ.' }]}><Input size="large" /></Form.Item></Col>
          <Col span={24}><Form.Item name="website_url" label={<RequiredLabel>Website</RequiredLabel>} rules={[{ required: !hasNoWebsite, message: 'Nhập website hoặc chọn không có website.' }, { type: 'url', warningOnly: hasNoWebsite, message: 'URL website không hợp lệ.' }]}><Input size="large" disabled={disabled || saveMutation.isPending || hasNoWebsite} placeholder="https://congty.vn" /></Form.Item></Col>
          <Col span={24}><Form.Item name="has_no_website" valuePropName="checked"><Checkbox onChange={changeNoWebsite}>Tôi không có website</Checkbox></Form.Item></Col>
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">Giới thiệu và phúc lợi</h2>
        <Form.Item name="description" label={<RequiredLabel>Mô tả công ty</RequiredLabel>} extra="Nên có ít nhất 500 ký tự để ứng viên hiểu rõ về công ty." rules={[{ required: true, message: 'Nhập mô tả công ty.' }]}><EditorField disabled={disabled || saveMutation.isPending} maxLength={10000} placeholder="Giới thiệu lĩnh vực, sản phẩm, văn hóa và môi trường làm việc…" /></Form.Item>
        <Form.Item name="employee_benefits" label="Phúc lợi nhân viên"><EditorField disabled={disabled || saveMutation.isPending} maxLength={10000} placeholder="Mô tả chính sách đãi ngộ và phúc lợi…" /></Form.Item>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">Hình ảnh công ty</h2>
        <p className="company-form-section__description">Tối đa 10 ảnh JPG, PNG hoặc WebP; khuyến nghị 1200×800 px, tỉ lệ 3:2.</p>
        <div className="company-gallery">
          {visibleCompanyImages.map((image) => <div key={image.id} className="company-gallery__item"><Image src={image.image_url} alt="Ảnh công ty" />{canManageMedia && <Button danger shape="circle" icon={<DeleteOutlined />} aria-label="Xóa ảnh" onClick={() => stageExistingImageDeletion(image.id)} />}</div>)}
          {pendingGalleryUrls.map((imageUrl, index) => <div key={imageUrl} className="company-gallery__item company-gallery__item--pending"><Image src={imageUrl} alt={`Ảnh công ty đang chờ duyệt ${index + 1}`} /><span className="company-gallery__pending-label">Chờ duyệt</span></div>)}
          {galleryFiles.map((file, index) => <div key={`${file.name}-${index}`} className="company-gallery__item"><Image src={URL.createObjectURL(file)} alt={file.name} /><Button danger shape="circle" icon={<DeleteOutlined />} aria-label={`Xóa ${file.name}`} onClick={() => setGalleryFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} /><span title={file.name}>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>)}
          {canManageMedia && galleryItemCount < 10 && <Upload disabled={mediaDisabled} multiple showUploadList={false} accept=".jpg,.jpeg,.png,.webp" beforeUpload={(file) => addGalleryFiles([file])}><button type="button" disabled={mediaDisabled} className="company-gallery__add"><PlusOutlined /><span>Thêm ảnh</span></button></Upload>}
        </div>
      </section>

      <div className="company-form-actions">
        {onCancel && <Button size="large" onClick={onCancel}>Hủy</Button>}
        <Button type="primary" htmlType="submit" size="large" icon={<PlusOutlined />} loading={saveMutation.isPending}>{isEdit ? 'Gửi yêu cầu cập nhật' : 'Lưu và liên kết công ty'}</Button>
      </div>

      <Modal
        open={isSensitiveModalOpen}
        title="Xác nhận thay đổi thông tin pháp lý"
        onCancel={() => setSensitiveModalOpen(false)}
        footer={(
          <>
            <Button onClick={() => setSensitiveModalOpen(false)}>Hủy</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={confirmSensitiveSubmit}>
              Gửi yêu cầu duyệt
            </Button>
          </>
        )}
        destroyOnClose={false}
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title="Bạn đang thay đổi tên đăng ký hoặc mã số thuế"
          description="Nhập lý do và cung cấp hồ sơ chứng minh. Dữ liệu hiện tại chỉ thay đổi sau khi quản trị viên phê duyệt."
        />
        {documentsRequiringReplacement.length > 0 && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title="Giấy tờ trước chưa đạt yêu cầu"
            description={documentsRequiringReplacement.map((document) => (
              <div key={document.public_id || document.id}>
                <strong>{document.doc_type_label || document.doc_type}:</strong>{' '}
                {document.review_note || 'Vui lòng chọn tệp mới để gửi lại.'}
              </div>
            ))}
          />
        )}
        <Form.Item name="update_reason" label={<RequiredLabel>Lý do thay đổi</RequiredLabel>} rules={[{ required: true, whitespace: true, message: 'Nhập lý do thay đổi.' }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="proof_type" label={<RequiredLabel>Loại hồ sơ chứng minh</RequiredLabel>} rules={[{ validator: validateSensitiveProof }]}>
          <Radio.Group className="grid gap-3">
            <Radio value="business_registration">Giấy đăng ký doanh nghiệp hoặc giấy tờ tương đương</Radio>
            {proofType === 'business_registration' && (
              <div className="company-proof-upload">
                <Upload {...uploadProps(setBusinessProofFile)}><Button aria-label="Chọn giấy đăng ký doanh nghiệp" icon={<UploadOutlined />}>Chọn giấy đăng ký doanh nghiệp</Button></Upload>
                {!businessProofFile && retainedProofTypes.has('business_registration') && <small>Đang giữ giấy tờ đã nộp ở lần trước.</small>}
                {replacementProofTypes.has('business_registration') && !businessProofFile && <small className="company-proof-upload__required">Cần chọn tệp mới theo yêu cầu của quản trị viên.</small>}
              </div>
            )}
            <Radio value="authorization_and_id">Giấy ủy quyền và giấy tờ định danh</Radio>
            {proofType === 'authorization_and_id' && (
              <div className="company-proof-upload company-proof-upload--double">
                <Upload {...uploadProps(setAuthorizationFile)}><Button aria-label="Chọn giấy ủy quyền" icon={<UploadOutlined />}>Chọn giấy ủy quyền</Button></Upload>
                <Upload {...uploadProps(setIdentityFile)}><Button aria-label="Chọn CCCD hoặc Hộ chiếu" icon={<UploadOutlined />}>Chọn CCCD / Hộ chiếu</Button></Upload>
                {!authorizationFile && !identityFile && retainedProofTypes.has('authorization_letter') && retainedProofTypes.has('identity_document') && <small>Đang giữ bộ giấy tờ đã nộp ở lần trước.</small>}
                {(replacementProofTypes.has('authorization_letter') || replacementProofTypes.has('identity_document')) && <small className="company-proof-upload__required">Chọn tệp mới cho từng giấy tờ được yêu cầu bổ sung.</small>}
              </div>
            )}
          </Radio.Group>
        </Form.Item>
      </Modal>

      <Modal
        open={isTradeProofModalOpen}
        title="Giấy tờ chứng minh Tên thương mại"
        onCancel={() => setTradeProofModalOpen(false)}
        footer={<><Button onClick={() => setTradeProofModalOpen(false)}>Hủy</Button><Button type="primary" onClick={saveTradeProof}>Lưu</Button></>}
        destroyOnClose
      >
        <Radio.Group value={tradeProofSource} onChange={(event) => setTradeProofSource(event.target.value)} className="company-trade-proof-modal__sources">
          <Radio value="file">Giấy tờ</Radio>
          <Radio value="website">Website</Radio>
        </Radio.Group>
        {tradeProofSource === 'file' ? (
          <div className="company-trade-proof-modal__field">
            <Upload
              maxCount={1}
              accept=".jpeg,.jpg,.png,.pdf"
              beforeUpload={(file) => {
                const error = validateTradeNameProof(file)
                if (error) message.error(error)
                else setTradeProofDraftFile(file)
                return false
              }}
              onRemove={() => setTradeProofDraftFile(null)}
            >
              <Button icon={<UploadOutlined />}>Chọn tệp</Button>
            </Upload>
            <p>Dung lượng tối đa 5 MB, định dạng: .jpeg, .jpg, .png, .pdf</p>
          </div>
        ) : (
          <div className="company-trade-proof-modal__field">
            <Input size="large" value={tradeProofDraftWebsite} onChange={(event) => setTradeProofDraftWebsite(event.target.value)} placeholder="https://" />
          </div>
        )}
      </Modal>
    </Form>
  )
}

function RequiredLabel({ children }) {
  return <>{children} <span className="company-required">*</span></>
}
