import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getJobBenefits,
  getJobLanguages,
  getSkills,
  jobKeys,
} from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { message } from '@/shared/lib/toast'
import {
  buildJobPayload,
  createAiJobFormPatch,
  createJobFormValues,
  getJobFormProgress,
} from '../model/job-form-values'
import ApplicationInfoFields from './ApplicationInfoFields'
import AutomaticApplicationStatusFields from './AutomaticApplicationStatusFields'
import BasicJobService from './BasicJobService'
import CandidateExpectationFields from './CandidateExpectationFields'
import JobDescriptionFields from './JobDescriptionFields'
import JobFormPreview from './JobFormPreview'
import JobFormProgress from './JobFormProgress'
import JobFormSection from './JobFormSection'
import JobGeneralFields from './JobGeneralFields'
import PostingQuotaNotice from './PostingQuotaNotice'
import './post-job-form.css'

export default function PostJobForm({
  aiSuggestion,
  aiSuggestionKey,
  form: providedForm,
  initialValues,
  campaigns = [],
  categories = [],
  postingContext,
  defaultDeadlineDays,
  maxDeadlineDays,
  isDraft,
  requiresNewCredit,
  submitLabel,
  submitting,
  errorMessage,
  creatingCampaign,
  onCreateCampaign,
  onCreateSkill,
  onAiSuggestionApplied,
  onSaveDraft,
  onPublish,
  onValuesChange,
}) {
  const [internalForm] = Form.useForm()
  const form = providedForm || internalForm
  const initializedFormRef = useRef(null)
  const appliedAiSuggestionRef = useRef(null)
  const [activeSection, setActiveSection] = useState('general')
  const [openSections, setOpenSections] = useState(() => new Set(['general', 'description', 'expectations', 'application', 'services']))
  const [invalidSections, setInvalidSections] = useState(() => new Set())
  const [invalidFieldNames, setInvalidFieldNames] = useState(() => new Set())
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces })
  const benefitsQuery = useQuery({ queryKey: jobKeys.benefits, queryFn: getJobBenefits })
  const languagesQuery = useQuery({ queryKey: jobKeys.languages, queryFn: getJobLanguages })
  const skillsQuery = useQuery({ queryKey: jobKeys.skills, queryFn: () => getSkills() })
  const values = Form.useWatch([], form) || createJobFormValues(initialValues, { defaultDeadlineDays })
  const sections = useMemo(() => getJobFormProgress(values), [values])

  useEffect(() => {
    const shouldInitialize = initializedFormRef.current !== form
    const shouldApplyAiSuggestion = Boolean(
      aiSuggestion
      && aiSuggestionKey
      && appliedAiSuggestionRef.current !== aiSuggestionKey,
    )
    if (!shouldInitialize && !shouldApplyAiSuggestion) return

    const nextValues = shouldInitialize
      ? createJobFormValues(initialValues, { defaultDeadlineDays })
      : {}
    if (shouldApplyAiSuggestion) {
      Object.assign(nextValues, createAiJobFormPatch(aiSuggestion))
    }

    form.setFieldsValue(nextValues)
    initializedFormRef.current = form

    if (shouldApplyAiSuggestion) {
      appliedAiSuggestionRef.current = aiSuggestionKey
      onAiSuggestionApplied?.(aiSuggestionKey)
    }
  }, [
    aiSuggestion,
    aiSuggestionKey,
    defaultDeadlineDays,
    form,
    initialValues,
    onAiSuggestionApplied,
  ])

  const primaryCategory = categories.find((item) => item.id === values.category_assignments?.[0]?.category)
  const domainNames = categories
    .filter((item) => values.domain_category_ids?.includes(item.id))
    .map((item) => item.name)
  const selectedCampaign = campaigns.find((item) => item.public_id === values.campaign)
  const benefitNames = (benefitsQuery.data || [])
    .filter((item) => values.benefit_ids?.includes(item.id))
    .map((item) => item.name)

  function selectSection(key) {
    setActiveSection(key)
    setOpenSections((current) => new Set([...current, key]))
  }

  function toggleSection(key) {
    setActiveSection(key)
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const updateInvalidSections = useCallback((fields) => {
    const sectionByField = {
      title: 'general',
      category_assignments: 'general',
      domain_category_ids: 'general',
      position_level: 'general',
      employment_type: 'general',
      work_types: 'general',
      salary_type: 'general',
      salary_min: 'general',
      salary_max: 'general',
      description: 'description',
      requirements: 'description',
      benefits: 'description',
      work_areas: 'description',
      work_schedules: 'description',
      work_schedule_note: 'description',
      education_level: 'expectations',
      experience_years: 'expectations',
      gender_requirement: 'expectations',
      age_min: 'expectations',
      age_max: 'expectations',
      required_skill_ids: 'expectations',
      preferred_skill_ids: 'expectations',
      language_requirements: 'expectations',
      deadline: 'application',
      number_of_vacancies: 'application',
      campaign: 'application',
      application_contact: 'application',
      auto_reject_stale_applications: 'application',
      auto_reject_after_days: 'application',
      auto_rejection_email_body: 'application',
    }
    const next = new Set()
    const nextFieldNames = new Set()
    fields.forEach((field) => {
      const rootName = Array.isArray(field.name) ? field.name[0] : field.name
      const section = sectionByField[rootName]
      if (field.errors?.length) {
        if (section) next.add(section)
        nextFieldNames.add((Array.isArray(field.name) ? field.name : [field.name]).join('.'))
      }
    })
    setInvalidSections(next)
    setInvalidFieldNames(nextFieldNames)
  }, [])

  const handleFinishFailed = useCallback(({ errorFields = [] }) => {
    updateInvalidSections(errorFields)
    const firstError = errorFields.flatMap((field) => field.errors || []).find(Boolean)
    message.warning(
      firstError || 'Vui lòng hoàn thiện các trường bắt buộc trước khi gửi duyệt.',
      { duration: 5000, id: 'post-job-validation-error' },
    )
  }, [updateInvalidSections])

  return (
    <Form
      className="post-job-form"
      form={form}
      layout="vertical"
      scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
      onFinish={(formValues) => onPublish(buildJobPayload(formValues))}
      onFieldsChange={(_, allFields) => updateInvalidSections(allFields)}
      onFinishFailed={handleFinishFailed}
      onValuesChange={onValuesChange}
    >
      <div className="grid items-start gap-4 bg-[#fafafa] p-4 sm:p-5 xl:pt-4 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="post-job-sticky-col min-w-0">
          <JobFormProgress
            sections={sections}
            activeSection={activeSection}
            openSections={openSections}
            invalidFieldNames={invalidFieldNames}
            onSelect={selectSection}
          />
        </div>

        <main className="min-w-0 space-y-3">
          {errorMessage && <Alert type="error" showIcon title="Chưa thể lưu tin tuyển dụng" description={errorMessage} />}
          {requiresNewCredit && postingContext && (
            <PostingQuotaNotice postingContext={postingContext} />
          )}
          {(benefitsQuery.isError || languagesQuery.isError || skillsQuery.isError) && (
            <Alert type="warning" showIcon title="Một số danh mục bổ sung chưa tải được" description="Tải lại trang để chọn đầy đủ quyền lợi, kỹ năng và ngoại ngữ." />
          )}
          <JobFormSection
            id="general"
            number={1}
            title="Thông tin chung"
            progress={sections[0]}
            invalid={invalidSections.has('general')}
            open={openSections.has('general')}
            active={activeSection === 'general'}
            onToggle={() => toggleSection('general')}
          >
            <JobGeneralFields form={form} categories={categories} />
          </JobFormSection>
          <JobFormSection
            id="description"
            number={2}
            title="Mô tả công việc"
            progress={sections[1]}
            invalid={invalidSections.has('description')}
            open={openSections.has('description')}
            active={activeSection === 'description'}
            onToggle={() => toggleSection('description')}
          >
            <JobDescriptionFields form={form} provinces={provincesQuery.data || []} benefits={benefitsQuery.data || []} />
          </JobFormSection>
          <JobFormSection
            id="expectations"
            number={3}
            title="Kỳ vọng về ứng viên"
            progress={sections[2]}
            invalid={invalidSections.has('expectations')}
            open={openSections.has('expectations')}
            active={activeSection === 'expectations'}
            onToggle={() => toggleSection('expectations')}
          >
            <CandidateExpectationFields form={form} skills={skillsQuery.data || []} languages={languagesQuery.data || []} onCreateSkill={onCreateSkill} />
          </JobFormSection>
          <JobFormSection
            id="application"
            number={4}
            title="Thông tin nhận hồ sơ"
            progress={sections[3]}
            invalid={invalidSections.has('application')}
            open={openSections.has('application')}
            active={activeSection === 'application'}
            onToggle={() => toggleSection('application')}
          >
            <ApplicationInfoFields
              campaigns={campaigns}
              creatingCampaign={creatingCampaign}
              maxDeadlineDays={maxDeadlineDays}
              onCreateCampaign={onCreateCampaign}
            />
            <AutomaticApplicationStatusFields />
          </JobFormSection>
          <JobFormSection
            id="services"
            number={5}
            title="Dịch vụ và gia tăng hiệu quả"
            progress={sections[4]}
            invalid={invalidSections.has('services')}
            open={openSections.has('services')}
            active={activeSection === 'services'}
            onToggle={() => toggleSection('services')}
          >
            <BasicJobService
              jobPublicId={initialValues?.public_id}
              jobStatus={initialValues?.status}
              activationEnabled={postingContext?.services?.activation_enabled === true}
              refreshEnabled={postingContext?.services?.refresh_enabled === true}
              metricsEnabled={postingContext?.services?.metrics_enabled === true}
            />
          </JobFormSection>

          <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 backdrop-blur sm:flex-row sm:justify-end">
            <Button
              size="large"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => onSaveDraft(buildJobPayload(form.getFieldsValue(true)))}
            >
              {isDraft ? 'Lưu nháp' : 'Lưu thay đổi'}
            </Button>
            <Button
              size="large"
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={requiresNewCredit && postingContext && !postingContext.job_postable}
            >
              {submitLabel || (isDraft ? 'Gửi duyệt tin' : 'Lưu và cập nhật')}
            </Button>
          </div>
        </main>

        <JobFormPreview
          values={values}
          companyName={initialValues?.company_name}
          categoryName={primaryCategory?.name}
          domainNames={domainNames}
          campaignName={selectedCampaign?.name}
          provinces={provincesQuery.data || []}
          skills={skillsQuery.data || []}
          languages={languagesQuery.data || []}
          benefitNames={benefitNames}
        />
      </div>
    </Form>
  )
}
