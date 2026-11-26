import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, InputNumber, Select } from 'antd'
import { useState } from 'react'
import {
  EDUCATION_LEVEL_LABELS,
  EXPERIENCE_YEARS_LABELS,
  getSkills,
  jobKeys,
} from '@/entities/job/job'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const PROFICIENCY_OPTIONS = [
  { value: 'basic', label: m.employer_job_preview_proficiency_basic() },
  { value: 'conversational', label: m.employer_job_preview_proficiency_conversational() },
  { value: 'working', label: m.employer_job_preview_proficiency_working() },
  { value: 'professional', label: m.employer_job_preview_proficiency_professional() },
  { value: 'native', label: m.employer_job_preview_proficiency_native() },
]

function SkillMultiSelect({ value = [], onChange, options, placeholder, onCreateSkill, disabledSkillIds = [] }) {
  const [searchValue, setSearchValue] = useState('')
  const [creating, setCreating] = useState(false)
  // Điện thoại hiện đủ kỹ năng đã chọn thay vì gom thành "+N".
  const isPhone = useMediaQuery('(max-width: 639px)')
  const normalizedSearch = searchValue.trim().replace(/\s+/g, ' ')
  const searchQuery = useQuery({
    queryKey: jobKeys.skillSearch(normalizedSearch),
    queryFn: () => getSkills({ search: normalizedSearch }),
    enabled: normalizedSearch.length >= 2,
  })
  const matchingOptions = (searchQuery.data || []).map((item) => ({ value: item.id, label: item.name }))
  const mergedOptions = [...options, ...matchingOptions]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index)
    .map((item) => ({ ...item, disabled: item.disabled || disabledSkillIds.includes(item.value) }))
  const hasExactMatch = mergedOptions.some((item) => item.label.toLocaleLowerCase('vi') === normalizedSearch.toLocaleLowerCase('vi'))

  async function addSkill() {
    if (!normalizedSearch || hasExactMatch || creating) return

    setCreating(true)
    try {
      const skill = await onCreateSkill(normalizedSearch)
      if (!value.includes(skill.id)) onChange([...value, skill.id])
      setSearchValue('')
    } catch {
      message.error(m.employer_job_form_add_skill_failed())
    } finally {
      setCreating(false)
    }
  }

  return (
    <Select
      mode="multiple"
      showSearch
      value={value}
      optionFilterProp="label"
      maxTagCount={isPhone ? undefined : 'responsive'}
      options={mergedOptions}
      placeholder={placeholder}
      searchValue={searchValue}
      onSearch={setSearchValue}
      onChange={onChange}
      popupRender={(menu) => (
        <>
          {menu}
          {normalizedSearch && !hasExactMatch && !searchQuery.isFetching && (
            <div className="border-t border-slate-100 p-1.5" onMouseDown={(event) => event.preventDefault()}>
              <Button type="text" size="small" className="!w-full !justify-start !text-[var(--brand-primary)]" loading={creating} onClick={addSkill}>
                {m.employer_job_form_add_skill({ name: normalizedSearch })}
              </Button>
            </div>
          )}
        </>
      )}
    />
  )
}

export default function CandidateExpectationFields({ form, skills, languages, onCreateSkill }) {
  const requiredSkillIds = Form.useWatch('required_skill_ids', form) || []
  const skillOptions = skills.map((item) => ({ value: item.id, label: item.name }))
  const preferredSkillOptions = skillOptions.map((item) => ({
    ...item,
    disabled: requiredSkillIds.includes(item.value),
  }))

  return (
    <>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="education_level" label={m.employer_job_form_education()} rules={[{ required: true, message: m.employer_job_form_education_required() }]}>
          <Select options={toOptions(EDUCATION_LEVEL_LABELS)} placeholder={m.employer_job_form_education_placeholder()} />
        </Form.Item>
        <Form.Item name="experience_years" label={m.employer_job_form_experience()} rules={[{ required: true, message: m.employer_job_form_experience_required() }]}>
          <Select options={toOptions(EXPERIENCE_YEARS_LABELS)} placeholder={m.employer_job_form_experience_placeholder()} />
        </Form.Item>
      </div>
      <div className="post-job-age-grid grid gap-x-4 md:grid-cols-3">
        <Form.Item name="gender_requirement" label={m.employer_job_preview_gender()}>
          <Select options={[
            { value: 'any', label: m.employer_job_preview_gender_any() },
            { value: 'male', label: m.employer_job_preview_gender_male() },
            { value: 'female', label: m.employer_job_preview_gender_female() },
          ]} placeholder={m.employer_job_form_gender_placeholder()} />
        </Form.Item>
        <Form.Item name="age_min" label={m.employer_job_form_age_min()} rules={[{ type: 'number', min: 15, max: 100, message: m.employer_job_form_age_range_error() }]}> 
          <InputNumber inputMode="numeric" min={15} max={100} className="!w-full" placeholder={m.employer_job_form_age_min_placeholder()} />
        </Form.Item>
        <Form.Item
          name="age_max"
          label={m.employer_job_form_age_max()}
          dependencies={['age_min']}
          rules={[
            { type: 'number', min: 15, max: 100, message: m.employer_job_form_age_range_error() },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const minimum = getFieldValue('age_min')
                if (value == null || minimum == null || value >= minimum) return Promise.resolve()
                return Promise.reject(new Error(m.employer_job_form_age_max_error()))
              },
            }),
          ]}
        >
          <InputNumber inputMode="numeric" min={15} max={100} className="!w-full" placeholder={m.employer_job_form_age_max_placeholder()} />
        </Form.Item>
      </div>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="required_skill_ids" label={m.employer_job_form_required_skills()}>
          <SkillMultiSelect options={skillOptions} placeholder={m.employer_job_form_required_skills_placeholder()} onCreateSkill={onCreateSkill} />
        </Form.Item>
        <Form.Item name="preferred_skill_ids" label={m.employer_job_form_preferred_skills()}>
          <SkillMultiSelect options={preferredSkillOptions} placeholder={m.employer_job_form_preferred_skills_placeholder()} onCreateSkill={onCreateSkill} disabledSkillIds={requiredSkillIds} />
        </Form.Item>
      </div>

      <div className="mb-2 text-sm font-semibold text-slate-700">{m.employer_job_form_languages()}</div>
      <Form.List name="language_requirements">
        {(fields, { add, remove }) => (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.key} className="border-t border-slate-200 pt-3">
                <div className="grid gap-x-3 md:grid-cols-[1fr_1fr_auto]">
                  <Form.Item name={[field.name, 'language']} label={m.employer_job_form_language_n({ index: index + 1 })} rules={[{ required: true, message: m.employer_job_form_language_required() }]}> 
                    <Select showSearch optionFilterProp="label" options={languages.map((item) => ({ value: item.id, label: item.name }))} placeholder={m.employer_job_form_language_placeholder()} />
                  </Form.Item>
                  <Form.Item name={[field.name, 'proficiency_level']} label={m.employer_job_form_proficiency()}>
                    <Select allowClear options={PROFICIENCY_OPTIONS} placeholder={m.employer_job_form_proficiency_placeholder()} />
                  </Form.Item>
                  <Button className="self-center md:mt-2" danger type="text" icon={<DeleteOutlined />} aria-label={m.employer_job_form_remove_language({ index: index + 1 })} onClick={() => remove(field.name)} />
                </div>
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ sort_order: fields.length })}>
              {m.employer_job_form_add_language()}
            </Button>
          </div>
        )}
      </Form.List>
    </>
  )
}
