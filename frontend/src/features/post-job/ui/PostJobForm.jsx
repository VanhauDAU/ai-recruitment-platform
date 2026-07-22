import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getJobBenefits,
  getJobLanguages,
  getSkills,
  jobKeys,
} from '@/entities/job'
import { getProvinces } from '@/entities/location'
import {
  buildJobPayload,
  createJobFormValues,
  getJobFormProgress,
} from '../model/job-form-values'
import ApplicationInfoFields from './ApplicationInfoFields'
import BasicJobService from './BasicJobService'
import CandidateExpectationFields from './CandidateExpectationFields'
import JobDescriptionFields from './JobDescriptionFields'
import JobFormPreview from './JobFormPreview'
import JobFormProgress from './JobFormProgress'
import JobFormSection from './JobFormSection'
import JobGeneralFields from './JobGeneralFields'
import './post-job-form.css'

export default function PostJobForm({
  initialValues,
  campaigns = [],
  categories = [],
  postingContext,
  isDraft,
  requiresNewCredit,
  submitLabel,
  submitting,
  errorMessage,
  onCreateSkill,
  onSaveDraft,
  onPublish,
}) {
  const [form] = Form.useForm()
  const [activeSection, setActiveSection] = useState('general')
  const [openSections, setOpenSections] = useState(() => new Set(['general', 'description', 'expectations', 'application', 'services']))
  const [invalidSections, setInvalidSections] = useState(() => new Set())
  const [invalidFieldNames, setInvalidFieldNames] = useState(() => new Set())
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces })
  const benefitsQuery = useQuery({ queryKey: jobKeys.benefits, queryFn: getJobBenefits })
  const languagesQuery = useQuery({ queryKey: jobKeys.languages, queryFn: getJobLanguages })
  const skillsQuery = useQuery({ queryKey: jobKeys.skills, queryFn: () => getSkills() })
  const values = Form.useWatch([], form) || createJobFormValues(initialValues)
  const sections = useMemo(() => getJobFormProgress(values), [values])

  useEffect(() => {
    form.setFieldsValue(createJobFormValues(initialValues))
  }, [form, initialValues])

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

  return (
    <Form
      className="post-job-form"
      form={form}
      layout="vertical"
      scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
      onFinish={(formValues) => onPublish(buildJobPayload(formValues))}
      onFieldsChange={(_, allFields) => updateInvalidSections(allFields)}
      onFinishFailed={({ errorFields }) => updateInvalidSections(errorFields)}
    >
      <div className="grid items-start gap-4 bg-[#fafafa] p-4 sm:p-5 xl:pt-0 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_300px]">
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
          {requiresNewCredit && postingContext && !postingContext.job_postable && (
            <Alert
              type="warning"
              showIcon
              title={postingContext.block_reason}
              description={`Còn ${postingContext.free_publish_remain}/${postingContext.free_publish_limit} lượt đăng miễn phí. Bạn vẫn có thể lưu bản nháp.`}
            />
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
            <ApplicationInfoFields campaigns={campaigns} />
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
            <BasicJobService />
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
