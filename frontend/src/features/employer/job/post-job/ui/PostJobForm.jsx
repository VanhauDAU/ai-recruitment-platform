import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Form } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getJobBenefits,
  getJobLanguages,
  getSkills,
  jobKeys,
} from '@/entities/job/job'
import { getProvinces } from '@/entities/system/location'
import { message } from '@/shared/lib/toast'
import {
  buildJobPayload,
  createAiJobFormPatch,
  createJobFormValues,
  getJobFormProgress,
} from '../model/job-form-values'
import ApplicationInfoFields from './ApplicationInfoFields'
import AutomaticApplicationStatusFields from './AutomaticApplicationStatusFields'
import CandidateExpectationFields from './CandidateExpectationFields'
import JobDescriptionFields from './JobDescriptionFields'
import JobFormPreview from './JobFormPreview'
import JobFormProgress from './JobFormProgress'
import JobFormSection from './JobFormSection'
import JobGeneralFields from './JobGeneralFields'
import PostingQuotaNotice from './PostingQuotaNotice'
import './post-job-form.css'
import { m } from '@/shared/config/i18n'

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
  const [openSections, setOpenSections] = useState(() => new Set(['general', 'description', 'expectations', 'application']))
  const [invalidSections, setInvalidSections] = useState(() => new Set())
  const [invalidFieldNames, setInvalidFieldNames] = useState(() => new Set())
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces })
  const benefitsQuery = useQuery({ queryKey: jobKeys.benefits, queryFn: getJobBenefits })
  const languagesQuery = useQuery({ queryKey: jobKeys.languages, queryFn: getJobLanguages })
  const skillsQuery = useQuery({ queryKey: jobKeys.skills, queryFn: () => getSkills() })
  const values = Form.useWatch([], form) || createJobFormValues(initialValues, { defaultDeadlineDays })
  // Making a job public requires accepting the commitment the backend has in force.
  const responsibilityStatement = postingContext?.responsibility_statement
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
      firstError || m.employer_job_form_complete_required(),
      { duration: 5000, id: 'post-job-validation-error' },
    )
  }, [updateInvalidSections])

  return (
    <Form
      className="post-job-form"
      form={form}
      layout="vertical"
      scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
      onFinish={(formValues) => onPublish(
        buildJobPayload(formValues),
        isDraft ? responsibilityStatement?.version : undefined,
      )}
      onFieldsChange={(_, allFields) => updateInvalidSections(allFields)}
      onFinishFailed={handleFinishFailed}
      onValuesChange={onValuesChange}
    >
      <div className="post-job-layout">
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
          {errorMessage && <Alert type="error" showIcon title={m.employer_job_form_save_failed()} description={errorMessage} />}
          {requiresNewCredit && postingContext && (
            <PostingQuotaNotice postingContext={postingContext} />
          )}
          {(benefitsQuery.isError || languagesQuery.isError || skillsQuery.isError) && (
            <Alert type="warning" showIcon title={m.employer_job_form_catalogs_failed()} description={m.employer_job_form_catalogs_failed_hint()} />
          )}
          <JobFormSection
            id="general"
            number={1}
            title={m.employer_job_progress_general()}
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
            title={m.employer_job_progress_description_group()}
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
            title={m.employer_job_progress_expectations()}
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
            title={m.employer_job_progress_application()}
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

          {isDraft && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              {responsibilityStatement ? (
                <Form.Item
                  name="responsibility_accepted"
                  valuePropName="checked"
                  className="!mb-0 !mt-2"
                  rules={[{
                    validator: (_, accepted) => (accepted
                      ? Promise.resolve()
                      : Promise.reject(new Error(m.employer_job_form_commitment_required()))),
                  }]}
                >
                  <Checkbox>{responsibilityStatement.text}</Checkbox>
                </Form.Item>
              ) : (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {m.employer_job_form_commitment_failed()}
                </p>
              )}
            </div>
          )}

          <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 backdrop-blur sm:flex-row sm:justify-end">
            <Button
              size="large"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => onSaveDraft(buildJobPayload(form.getFieldsValue(true)))}
            >
              {isDraft ? m.employer_job_form_save_draft() : m.employer_job_form_save_changes()}
            </Button>
            <Button
              size="large"
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={
                (requiresNewCredit && postingContext && !postingContext.job_postable)
                || (isDraft && !responsibilityStatement)
              }
            >
              {submitLabel || (isDraft ? m.employer_job_form_post() : m.employer_job_form_save_and_update())}
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
