import { ArrowLeftOutlined, BankOutlined, CameraOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Col, Form, Image, Input, Modal, Radio, Row, Select, Upload } from 'antd'
import { useMemo, useRef, useState } from 'react'
import {
  createEmployerCompany,
  createEmployerCompanyUpdateRequest,
  employerProfileKeys,
  getEmployerCompanyDocuments,
  prepareEmployerUpload,
  saveEmployerCompanyTradeNameWebsite,
  uploadEmployerCompanyDocument,
  uploadEmployerCompanyImage,
  uploadEmployerCompanyLogo,
} from '@/entities/account/employer-profile'
import { useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getUploadStatePresentation } from '@/shared/api/upload-session'
import { m } from '@/shared/config/i18n'
import { useUnsavedChanges } from '@/shared/hooks/use-unsaved-changes'
import { message } from '@/shared/lib/toast'
import RichTextEditor from '@/shared/ui/rich-text/RichTextEditor'
import {
  buildCompanyChanges,
  COMPANY_DESCRIPTION_MIN_LENGTH,
  companyDescriptionValidationError,
  companyTaxCodeValidationError,
  companyToForm,
  DEFAULT_COMPANY_FORM,
  hasCompanyFormValueChanges,
  validateCompanyImage,
} from '../model/company-form'

function EditorField(props) {
  const { status } = Form.Item.useStatus()
  return <RichTextEditor {...props} error={status === 'error'} />
}

function uploadProps(setFile, disabled) {
  return {
    maxCount: 1,
    disabled,
    accept: '.jpg,.jpeg,.png,.pdf',
    beforeUpload: (file) => { setFile(file); return false },
    onRemove: () => setFile(null),
  }
}

function validateTradeNameProof(file) {
  const extension = file?.name?.split('.').pop()?.toLowerCase()
  if (!['jpeg', 'jpg', 'png', 'pdf'].includes(extension)) return m.employer_company_form_proof_file_type()
  if (file.size > 5 * 1024 * 1024) return m.employer_company_form_proof_file_size()
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
  const configuredMinLength = useSiteSettings().settings.company_description_min_length
  const descriptionMinLength = Number.isInteger(configuredMinLength) ? configuredMinLength : COMPANY_DESCRIPTION_MIN_LENGTH
  const isEdit = Boolean(company)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const initialGalleryDeletionIds = useMemo(
    () => pendingRequest?.changes?.gallery_deletions || [],
    [pendingRequest?.changes?.gallery_deletions],
  )
  const [logoFile, setLogoFile] = useState(null)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [galleryDeletionIds, setGalleryDeletionIds] = useState(
    () => initialGalleryDeletionIds,
  )
  const [pendingTradeProof, setPendingTradeProof] = useState(null)
  const [tradeNameTouched, setTradeNameTouched] = useState(false)
  const [isTradeProofModalOpen, setTradeProofModalOpen] = useState(false)
  const [tradeProofSource, setTradeProofSource] = useState('file')
  const [tradeProofDraftFile, setTradeProofDraftFile] = useState(null)
  const [tradeProofDraftWebsite, setTradeProofDraftWebsite] = useState('')
  const [businessProofFile, setBusinessProofFile] = useState(null)
  const [authorizationFile, setAuthorizationFile] = useState(null)
  const [identityFile, setIdentityFile] = useState(null)
  const [isSensitiveModalOpen, setSensitiveModalOpen] = useState(false)
  const [pendingSubmitValues, setPendingSubmitValues] = useState(null)
  const [uploadState, setUploadState] = useState(null)
  const websiteBackup = useRef(company?.website_url || '')
  const tradeNameBackup = useRef(company?.trade_name || '')
  const initialValues = useMemo(
    () => company ? companyToForm(company, pendingRequest?.changes) : DEFAULT_COMPANY_FORM,
    [company, pendingRequest?.changes],
  )
  const [currentFormValues, setCurrentFormValues] = useState(null)
  const watchedValues = currentFormValues || initialValues
  const businessType = Form.useWatch('business_type', form) || initialValues.business_type
  const selectedIndustries = Form.useWatch('industries', form) || []
  const hasNoWebsite = Form.useWatch('has_no_website', form) ?? initialValues.has_no_website
  const hasNoLogo = Form.useWatch('has_no_logo', form) ?? initialValues.has_no_logo
  const sameTradeName = Form.useWatch('trade_name_same_as_registered', form) ?? initialValues.trade_name_same_as_registered
  const tradeNameRequired = !sameTradeName && (
    !isEdit
    || Boolean(company?.trade_name?.trim())
    || tradeNameTouched
    || Object.hasOwn(pendingRequest?.changes || {}, 'trade_name')
    || Object.hasOwn(pendingRequest?.changes || {}, 'trade_name_same_as_registered')
  )
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
  const replacementDocumentByType = useMemo(
    () => Object.fromEntries(
      documentsRequiringReplacement.map((document) => [document.doc_type, document]),
    ),
    [documentsRequiringReplacement],
  )

  function hasEditDraftChanges(values) {
    const galleryDeletionsChanged = JSON.stringify([...galleryDeletionIds].sort())
      !== JSON.stringify([...initialGalleryDeletionIds].sort())
    return hasCompanyFormValueChanges(values, initialValues)
      || Boolean(
        logoFile
        || galleryFiles.length
        || galleryDeletionsChanged
        || pendingTradeProof
        || businessProofFile
        || authorizationFile
        || identityFile,
      )
  }

  const hasDraftChanges = !isEdit || hasEditDraftChanges(watchedValues)
  const uploadStateMeta = getUploadStatePresentation(uploadState)

  const saveMutation = useMutation({
    mutationFn: save,
    onSuccess: async () => {
      setSensitiveModalOpen(false)
      setPendingSubmitValues(null)
      setUploadState(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employerProfileKeys.company }),
        queryClient.invalidateQueries({ queryKey: ['employer', 'profile'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
      ])
      message.success(isEdit ? m.employer_company_form_update_sent() : m.employer_company_form_created())
      await onCompleted?.()
    },
    onError: (error) => message.error(getApiErrorMessage(error, isEdit ? m.employer_company_form_update_failed() : m.employer_company_form_create_failed())),
  })
  const mediaDisabled = disabled || saveMutation.isPending || !canManageMedia
  // Lưu xong form đóng lại (onCompleted), nên chỉ cần tắt cờ khi đã lưu thành công.
  useUnsavedChanges(!saveMutation.isSuccess && Boolean(currentFormValues || logoFile || galleryFiles.length))

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
    const documentPurpose = isEdit ? 'employer_company_update' : 'employer_verification'
    const filesToPrepare = [
      logoFile && { file: logoFile, purpose: 'employer_company_update' },
      ...galleryFiles.map((file) => ({ file, purpose: 'employer_company_update' })),
      pendingTradeProof?.source_type === 'file'
        ? { file: pendingTradeProof.file, purpose: documentPurpose }
        : null,
      isSensitive && sensitiveProofType === 'business_registration' && businessProofFile
        ? { file: businessProofFile, purpose: documentPurpose }
        : null,
      isSensitive && sensitiveProofType === 'authorization_and_id' && authorizationFile
        ? { file: authorizationFile, purpose: documentPurpose }
        : null,
      isSensitive && sensitiveProofType === 'authorization_and_id' && identityFile
        ? { file: identityFile, purpose: documentPurpose }
        : null,
    ].filter(Boolean)
    const uploadSessions = new Map(await Promise.all(
      filesToPrepare.map(async ({ file, purpose }) => [
        file,
        await prepareEmployerUpload(file, purpose, {
          onStateChange: setUploadState,
        }),
      ]),
    ))
    let updateRequest = null
    if (isEdit) {
      const changes = buildCompanyChanges(normalized, company, {
        pendingChanges: pendingRequest?.changes,
      })
      if (logoFile) changes.logo_pending = true
      if (galleryFiles.length) changes.gallery_pending = true
      if (galleryDeletionIds.length) changes.gallery_deletions = galleryDeletionIds
      if (Object.keys(changes).length) {
        updateRequest = await createEmployerCompanyUpdateRequest({
          changes,
          reason: isSensitive ? reason : '',
          proof_type: isSensitive ? sensitiveProofType : '',
          ...(company.updated_at
            ? { base_company_updated_at: company.updated_at }
            : {}),
        })
      }
    } else {
      await createEmployerCompany({
        ...normalized,
        logo_pending: Boolean(logoFile),
      })
    }

    const requestOptions = (file, docType = '') => ({
      updateRequest: updateRequest?.public_id,
      uploadSession: uploadSessions.get(file),
      replaceDocument: replacementDocumentByType[docType]?.public_id,
    })
    if (logoFile) await uploadEmployerCompanyLogo(logoFile, requestOptions(logoFile))
    for (const file of galleryFiles) {
      await uploadEmployerCompanyImage(file, requestOptions(file))
    }
    if (pendingTradeProof?.source_type === 'file') {
      await uploadEmployerCompanyDocument(
        'trade_name_proof',
        pendingTradeProof.file,
        requestOptions(pendingTradeProof.file, 'trade_name_proof'),
      )
    }
    if (pendingTradeProof?.source_type === 'website') {
      await saveEmployerCompanyTradeNameWebsite(
        pendingTradeProof.file_url,
        {
          updateRequest: updateRequest?.public_id,
          replaceDocument: replacementDocumentByType.trade_name_proof?.public_id,
        },
      )
    }
    if (isSensitive && updateRequest) {
      if (sensitiveProofType === 'business_registration') {
        if (businessProofFile) {
          await uploadEmployerCompanyDocument(
            'business_registration',
            businessProofFile,
            requestOptions(businessProofFile, 'business_registration'),
          )
        }
      } else {
        if (authorizationFile) {
          await uploadEmployerCompanyDocument(
            'authorization_letter',
            authorizationFile,
            requestOptions(authorizationFile, 'authorization_letter'),
          )
        }
        if (identityFile) {
          await uploadEmployerCompanyDocument(
            'identity_document',
            identityFile,
            requestOptions(identityFile, 'identity_document'),
          )
        }
      }
    }
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
    if (files.length > available) message.warning(m.employer_company_form_gallery_limit())
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
    setTradeNameTouched(true)
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
    ) return Promise.reject(new Error(m.employer_company_form_business_proof_required()))
    if (
      proofType === 'authorization_and_id'
      && (
        (!authorizationFile && !(retainsSameProof && retainedProofTypes.has('authorization_letter')))
        || (!identityFile && !(retainsSameProof && retainedProofTypes.has('identity_document')))
      )
    ) return Promise.reject(new Error(m.employer_company_form_authorization_proof_required()))
    return Promise.resolve()
  }

  function validateTaxCode(_, value) {
    const keepsLegacyTaxCode = isEdit && value === initialValues.tax_code
    if (keepsLegacyTaxCode) return Promise.resolve()
    const error = companyTaxCodeValidationError(value)
    return error ? Promise.reject(new Error(error)) : Promise.resolve()
  }

  function validateDescription(_, value) {
    const keepsLegacyDescription = isEdit && value === initialValues.description
    if (keepsLegacyDescription) return Promise.resolve()
    const error = companyDescriptionValidationError(value, descriptionMinLength)
    return error ? Promise.reject(new Error(error)) : Promise.resolve()
  }

  function submitCompanyForm(values) {
    if (disabled || saveMutation.isPending) return
    if (isEdit && !hasEditDraftChanges(values)) {
      message.info(m.employer_company_form_no_changes())
      return
    }
    if (isSensitive) {
      setPendingSubmitValues(values)
      setSensitiveModalOpen(true)
      return
    }
    saveMutation.mutate(values)
  }

  function openRequestedProofUpload() {
    if (disabled || saveMutation.isPending) return
    if (replacementProofTypes.has('trade_name_proof')) {
      openTradeProofModal()
      return
    }
    setPendingSubmitValues(form.getFieldsValue(true))
    setSensitiveModalOpen(true)
  }

  async function confirmSensitiveSubmit() {
    if (disabled || saveMutation.isPending) return
    try {
      const proofValues = await form.validateFields(['update_reason', 'proof_type'])
      saveMutation.mutate({ ...pendingSubmitValues, ...proofValues })
    } catch {
      // Ant Design renders field-level validation feedback in the modal.
    }
  }

  function openTradeProofModal() {
    if (disabled || saveMutation.isPending) return
    const proof = currentTradeProof
    setTradeProofSource(proof?.source_type || 'file')
    setTradeProofDraftFile(pendingTradeProof?.source_type === 'file' ? pendingTradeProof.file : null)
    setTradeProofDraftWebsite(proof?.source_type === 'website' ? proof.file_url : '')
    setTradeProofModalOpen(true)
  }

  function saveTradeProof() {
    if (disabled || saveMutation.isPending) return
    if (tradeProofSource === 'file') {
      const error = validateTradeNameProof(tradeProofDraftFile)
      if (error) {
        message.error(error || m.employer_company_form_trade_proof_required())
        return
      }
      setPendingTradeProof({
        source_type: 'file',
        file: tradeProofDraftFile,
        file_url: URL.createObjectURL(tradeProofDraftFile),
        file_name: m.employer_company_form_trade_proof_document(),
      })
    } else {
      const websiteUrl = tradeProofDraftWebsite.trim()
      if (!isWebsiteUrl(websiteUrl)) {
        message.error(m.employer_company_form_trade_proof_url_invalid())
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

  const household = businessType === 'household'
  const logoLabel = household ? m.employer_company_form_logo_household() : m.employer_company_form_logo_company()
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
      onValuesChange={(_, values) => setCurrentFormValues(values)}
      requiredMark={false}
      className="company-form"
    >
      {isEdit && (
        <header className="company-form-intro">
          <Button
            className="company-form-intro__back"
            type="text"
            htmlType="button"
            icon={<ArrowLeftOutlined />}
            aria-label={m.employer_company_form_back_to_info()}
            disabled={saveMutation.isPending}
            onClick={onCancel}
          >
            {m.employer_company_form_back_to_info()}
          </Button>
        </header>
      )}
      {documentsRequiringReplacement.length > 0 && (
        <Alert
          className="company-form-document-request"
          type="warning"
          showIcon
          title={m.employer_company_form_documents_needed()}
          description={(
            <div className="company-form-document-request__content">
              {documentsRequiringReplacement.map((document) => (
                <p key={document.public_id || document.id}>
                  <strong>{document.doc_type_label || document.doc_type}:</strong>{' '}
                  {document.review_note || m.employer_company_form_upload_new_default()}
                </p>
              ))}
              <Button type="primary" disabled={disabled || saveMutation.isPending} aria-label={m.employer_company_form_choose_replacement()} icon={<UploadOutlined />} onClick={openRequestedProofUpload}>
                {m.employer_company_form_choose_replacement()}
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
            <button type="button" className="company-logo-upload" aria-label={m.employer_company_form_choose_logo()} title={m.employer_company_form_logo_hint()} disabled={mediaDisabled}>
              {(logoFile || pendingLogoUrl || company?.logo_url) && !hasNoLogo
                ? <img className="company-logo-preview" src={logoFile ? URL.createObjectURL(logoFile) : pendingLogoUrl || company.logo_url} alt={logoLabel} />
                : <span className="company-logo-placeholder"><BankOutlined /><span className="company-logo-placeholder__camera"><CameraOutlined /></span></span>}
            </button>
          </Upload>
          <h2 className="company-logo-title">{logoLabel} <span className="company-required">*</span></h2>
          <Form.Item name="has_no_logo" valuePropName="checked" className="!mb-0"><Checkbox disabled={mediaDisabled} onChange={(event) => event.target.checked && setLogoFile(null)}>{m.employer_company_form_no_logo()}</Checkbox></Form.Item>
        </div>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">{m.employer_company_form_legal_section()}</h2>
        <Form.Item name="business_type" label={<RequiredLabel>{m.employer_company_form_business_type()}</RequiredLabel>} rules={[{ required: true, message: m.employer_company_form_business_type_required() }]}>
          <Radio.Group className="company-business-type">
            {(catalogs.business_types || []).map((item) => <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>)}
          </Radio.Group>
        </Form.Item>
        <Alert
          className="company-tax-alert"
          type="info"
          showIcon
          title={household ? m.employer_company_form_tax_alert_household() : m.employer_company_form_tax_alert_company()}
        />
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}><Form.Item name="tax_code" label={<RequiredLabel>{household ? m.employer_company_form_tax_code_household() : m.employer_company_tax_code()}</RequiredLabel>} rules={[{ validator: validateTaxCode }]}><Input size="large" inputMode="numeric" maxLength={13} placeholder="0101234567" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="company_name" label={<RequiredLabel>{household ? m.employer_company_form_name_household() : m.employer_company_form_name_company()}</RequiredLabel>} rules={[{ required: true, whitespace: true, message: household ? m.employer_company_form_name_required_household() : m.employer_company_form_name_required_company() }]}><Input size="large" onChange={(event) => sameTradeName && form.setFieldValue('trade_name', event.target.value)} /></Form.Item></Col>
          <Col span={24}><Form.Item name="trade_name_same_as_registered" valuePropName="checked"><Checkbox onChange={changeSameTradeName}>{m.employer_company_form_same_trade_name()}</Checkbox></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="trade_name" label={tradeNameRequired ? <RequiredLabel>{m.employer_company_form_trade_name()}</RequiredLabel> : m.employer_company_form_trade_name()} rules={[{ required: tradeNameRequired, whitespace: true, message: m.employer_company_form_trade_name_required() }]}><Input size="large" disabled={sameTradeName} onChange={() => setTradeNameTouched(true)} /></Form.Item></Col>
          {!sameTradeName && <Col xs={24} md={12}>
            <Form.Item>
              {currentTradeProof ? (
                <div className="company-trade-proof">
                  <a href={currentTradeProof.file_url} target="_blank" rel="noreferrer" className="company-setting-link" title={currentTradeProof.source_type === 'website' ? currentTradeProof.file_url : m.employer_company_form_open_trade_proof()}>
                    <LinkOutlined /> {currentTradeProof.source_type === 'website' ? currentTradeProof.file_url : m.employer_company_form_trade_proof_document()}
                  </a>
                  <Button type="link" size="small" disabled={disabled || saveMutation.isPending} icon={<EditOutlined />} onClick={openTradeProofModal}>{m.employer_company_form_edit()}</Button>
                </div>
              ) : <Button type="link" disabled={disabled || saveMutation.isPending} icon={<PlusOutlined />} className="company-trade-proof__add" onClick={openTradeProofModal}>{m.employer_company_form_add_trade_proof()}</Button>}
            </Form.Item>
          </Col>}
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">{m.employer_company_form_operations_section()}</h2>
        <Row gutter={[16, 0]}>
          <Col span={24}><Form.Item name="industries" label={<RequiredLabel>{m.employer_company_industries()}</RequiredLabel>} rules={[{ required: true, type: 'array', min: 1, message: m.employer_company_form_industries_required() }]}><Select mode="multiple" size="large" showSearch optionFilterProp="label" options={industryOptions} placeholder={m.employer_company_form_industries_placeholder()} onChange={(values) => !values.includes(form.getFieldValue('primary_industry')) && form.setFieldValue('primary_industry', undefined)} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="primary_industry" label={<RequiredLabel>{m.employer_company_primary_industry()}</RequiredLabel>} rules={[{ required: true, message: m.employer_company_form_primary_industry_required() }]}><Select size="large" disabled={!selectedIndustries.length} options={selectedIndustryOptions} placeholder={selectedIndustries.length ? m.employer_company_form_primary_industry_placeholder() : m.employer_company_form_primary_industry_disabled()} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="company_size" label={<RequiredLabel>{m.employer_company_form_company_size()}</RequiredLabel>} rules={[{ required: true, message: m.employer_company_form_company_size_required() }]}><Select size="large" options={catalogs.company_sizes || []} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="markets" label={m.employer_company_markets()}><Select mode="multiple" size="large" options={catalogs.markets || []} placeholder={m.employer_company_form_markets_placeholder()} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="target_customers" label={m.employer_company_target_customers()}><Select mode="multiple" size="large" options={catalogs.target_customers || []} placeholder={m.employer_company_form_customers_placeholder()} /></Form.Item></Col>
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">{m.employer_company_form_contact_section()}</h2>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}><Form.Item name="email" label={<RequiredLabel>{m.employer_company_form_email()}</RequiredLabel>} rules={[{ required: true, type: 'email', message: m.employer_company_form_email_invalid() }]}><Input size="large" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="phone" label={<RequiredLabel>{m.employer_company_phone()}</RequiredLabel>} rules={[{ required: true, message: m.employer_company_form_phone_required() }, { pattern: /^\+?[0-9 .()-]{8,20}$/, message: m.employer_company_form_phone_invalid() }]}><Input size="large" /></Form.Item></Col>
          <Col span={24}><Form.Item name="address" label={<RequiredLabel>{m.employer_company_form_address()}</RequiredLabel>} rules={[{ required: true, whitespace: true, message: m.employer_company_form_address_required() }]}><Input size="large" /></Form.Item></Col>
          <Col span={24}><Form.Item name="website_url" label={<RequiredLabel>Website</RequiredLabel>} rules={[{ required: !hasNoWebsite, message: m.employer_company_form_website_required() }, { type: 'url', warningOnly: hasNoWebsite, message: m.employer_company_form_website_invalid() }]}><Input size="large" disabled={disabled || saveMutation.isPending || hasNoWebsite} placeholder="https://congty.vn" /></Form.Item></Col>
          <Col span={24}><Form.Item name="has_no_website" valuePropName="checked"><Checkbox onChange={changeNoWebsite}>{m.employer_company_form_no_website()}</Checkbox></Form.Item></Col>
        </Row>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">{m.employer_company_form_about_section()}</h2>
        <Form.Item name="description" label={<RequiredLabel>{m.employer_company_description()}</RequiredLabel>} extra={m.employer_company_form_description_extra({ min: descriptionMinLength })} rules={[{ validator: validateDescription }]}><EditorField disabled={disabled || saveMutation.isPending} maxLength={10000} placeholder={m.employer_company_form_description_placeholder()} /></Form.Item>
        <Form.Item name="employee_benefits" label={m.employer_company_employee_benefits()}><EditorField disabled={disabled || saveMutation.isPending} maxLength={10000} placeholder={m.employer_company_form_benefits_placeholder()} /></Form.Item>
      </section>

      <section className="company-form-section">
        <h2 className="company-form-section__title">{m.employer_company_images()}</h2>
        <p className="company-form-section__description">{m.employer_company_form_images_hint()}</p>
        <div className="company-gallery">
          {visibleCompanyImages.map((image) => <div key={image.id} className="company-gallery__item"><Image src={image.image_url} alt={m.employer_company_image_alt()} />{canManageMedia && <Button danger shape="circle" disabled={mediaDisabled} icon={<DeleteOutlined />} aria-label={m.employer_company_form_delete_image()} onClick={() => stageExistingImageDeletion(image.id)} />}</div>)}
          {pendingGalleryUrls.map((imageUrl, index) => <div key={imageUrl} className="company-gallery__item company-gallery__item--pending"><Image src={imageUrl} alt={m.employer_company_form_pending_image_alt({ index: index + 1 })} /><span className="company-gallery__pending-label">{m.employer_company_content_status_pending()}</span></div>)}
          {galleryFiles.map((file, index) => <div key={`${file.name}-${index}`} className="company-gallery__item"><Image src={URL.createObjectURL(file)} alt={file.name} /><Button danger shape="circle" disabled={mediaDisabled} icon={<DeleteOutlined />} aria-label={m.employer_company_form_delete_file({ name: file.name })} onClick={() => setGalleryFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} /><span title={file.name}>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>)}
          {canManageMedia && galleryItemCount < 10 && <Upload disabled={mediaDisabled} multiple showUploadList={false} accept=".jpg,.jpeg,.png,.webp" beforeUpload={(file) => addGalleryFiles([file])}><button type="button" disabled={mediaDisabled} className="company-gallery__add"><PlusOutlined /><span>{m.employer_company_gallery_add()}</span></button></Upload>}
        </div>
      </section>

      {uploadStateMeta && (
        <p className={`mb-3 text-sm ${uploadStateMeta.tone}`} role="status">
          {uploadStateMeta.text}
        </p>
      )}
      <div className="company-form-actions">
        {onCancel && (
          <Button
            size="large"
            htmlType="button"
            disabled={saveMutation.isPending}
            onClick={onCancel}
          >
            {m.employer_company_form_back()}
          </Button>
        )}
        <Button
          type="primary"
          htmlType="submit"
          size="large"
          disabled={disabled || !hasDraftChanges}
          aria-label={isEdit ? m.employer_company_form_submit_update() : m.employer_company_form_save_link()}
          title={isEdit && !hasDraftChanges ? m.employer_company_form_change_required() : undefined}
          icon={<PlusOutlined />}
          loading={saveMutation.isPending}
        >
          {isEdit ? m.employer_company_form_submit_update() : m.employer_company_form_save_link()}
        </Button>
      </div>

      <Modal
        open={isSensitiveModalOpen}
        title={m.employer_company_form_sensitive_title()}
        onCancel={() => setSensitiveModalOpen(false)}
        footer={(
          <>
            <Button onClick={() => setSensitiveModalOpen(false)}>{m.employer_company_cancel()}</Button>
            <Button type="primary" disabled={disabled} loading={saveMutation.isPending} onClick={confirmSensitiveSubmit}>
              {m.employer_company_form_submit_review()}
            </Button>
          </>
        )}
        destroyOnHidden={false}
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title={m.employer_company_form_sensitive_alert()}
          description={m.employer_company_form_sensitive_alert_description()}
        />
        {uploadStateMeta && (
          <p className={`mb-4 text-sm ${uploadStateMeta.tone}`} role="status">
            {uploadStateMeta.text}
          </p>
        )}
        {documentsRequiringReplacement.length > 0 && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={m.employer_company_form_previous_documents_rejected()}
            description={documentsRequiringReplacement.map((document) => (
              <div key={document.public_id || document.id}>
                <strong>{document.doc_type_label || document.doc_type}:</strong>{' '}
                {document.review_note || m.employer_company_form_choose_new_file_default()}
              </div>
            ))}
          />
        )}
        <Form.Item name="update_reason" label={<RequiredLabel>{m.employer_company_form_update_reason()}</RequiredLabel>} rules={[{ required: true, whitespace: true, message: m.employer_company_form_update_reason_required() }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="proof_type" label={<RequiredLabel>{m.employer_company_form_proof_type()}</RequiredLabel>} rules={[{ validator: validateSensitiveProof }]}>
          <Radio.Group className="grid gap-3">
            <Radio value="business_registration">{m.employer_company_form_proof_business()}</Radio>
            {proofType === 'business_registration' && (
              <div className="company-proof-upload">
                <Upload {...uploadProps(setBusinessProofFile, disabled || saveMutation.isPending)}><Button aria-label={m.employer_company_form_choose_business_proof()} icon={<UploadOutlined />}>{m.employer_company_form_choose_business_proof()}</Button></Upload>
                {!businessProofFile && retainedProofTypes.has('business_registration') && <small>{m.employer_company_form_keeping_previous_document()}</small>}
                {replacementProofTypes.has('business_registration') && !businessProofFile && <small className="company-proof-upload__required">{m.employer_company_form_new_file_required()}</small>}
              </div>
            )}
            <Radio value="authorization_and_id">{m.employer_company_form_proof_authorization()}</Radio>
            {proofType === 'authorization_and_id' && (
              <div className="company-proof-upload company-proof-upload--double">
                <Upload {...uploadProps(setAuthorizationFile, disabled || saveMutation.isPending)}><Button aria-label={m.employer_company_form_choose_authorization()} icon={<UploadOutlined />}>{m.employer_company_form_choose_authorization()}</Button></Upload>
                <Upload {...uploadProps(setIdentityFile, disabled || saveMutation.isPending)}><Button aria-label={m.employer_company_form_choose_identity_label()} icon={<UploadOutlined />}>{m.employer_company_form_choose_identity()}</Button></Upload>
                {!authorizationFile && !identityFile && retainedProofTypes.has('authorization_letter') && retainedProofTypes.has('identity_document') && <small>{m.employer_company_form_keeping_previous_documents()}</small>}
                {(replacementProofTypes.has('authorization_letter') || replacementProofTypes.has('identity_document')) && <small className="company-proof-upload__required">{m.employer_company_form_new_files_required()}</small>}
              </div>
            )}
          </Radio.Group>
        </Form.Item>
      </Modal>

      <Modal
        open={isTradeProofModalOpen}
        title={m.employer_company_form_trade_proof_title()}
        onCancel={() => setTradeProofModalOpen(false)}
        footer={<><Button onClick={() => setTradeProofModalOpen(false)}>{m.employer_company_cancel()}</Button><Button type="primary" disabled={disabled || saveMutation.isPending} onClick={saveTradeProof}>{m.employer_company_content_save()}</Button></>}
        destroyOnHidden
      >
        <Radio.Group value={tradeProofSource} onChange={(event) => setTradeProofSource(event.target.value)} className="company-trade-proof-modal__sources">
          <Radio value="file">{m.employer_company_form_trade_proof_source_file()}</Radio>
          <Radio value="website">Website</Radio>
        </Radio.Group>
        {tradeProofSource === 'file' ? (
          <div className="company-trade-proof-modal__field">
            <Upload
              maxCount={1}
              disabled={disabled || saveMutation.isPending}
              accept=".jpeg,.jpg,.png,.pdf"
              beforeUpload={(file) => {
                const error = validateTradeNameProof(file)
                if (error) message.error(error)
                else setTradeProofDraftFile(file)
                return false
              }}
              onRemove={() => setTradeProofDraftFile(null)}
            >
              <Button icon={<UploadOutlined />}>{m.employer_company_form_choose_file()}</Button>
            </Upload>
            <p>{m.employer_company_form_file_hint()}</p>
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
