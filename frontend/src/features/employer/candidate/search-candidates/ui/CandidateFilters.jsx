import { InfoCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Input, InputNumber, Select, Tooltip } from 'antd'
import { useId } from 'react'
import { educationLevelLabel, languageLabel, languageLevelLabel, positionLevelLabel } from '@/entities/application/job-fit'
import { getJobCategories } from '@/entities/job/job'
import { getProvinces } from '@/entities/system/location'
import { m } from '@/shared/config/i18n'

const LANGUAGES = ['en', 'ja', 'ko', 'zh', 'fr']
const LANGUAGE_LEVELS = ['basic', 'conversational', 'working', 'professional', 'native']
const POSITION_LEVELS = ['intern', 'employee', 'team_lead', 'supervisor', 'manager', 'branch_manager', 'vice_director', 'director']
const EDUCATION_LEVELS = ['high_school', 'intermediate', 'college', 'university', 'postgraduate']
const CATALOG_STALE = 10 * 60 * 1000

function Field({ label, hint, htmlFor, children }) {
  return (
    <div className="cs-field">
      <label className="cs-field__label" htmlFor={htmlFor}>
        {label}
        {hint && (
          <Tooltip title={hint}>
            <InfoCircleOutlined className="cs-field__hint" aria-label={hint} />
          </Tooltip>
        )}
      </label>
      {children}
    </div>
  )
}

function KeywordTags({ id, value, onChange }) {
  return (
    <Select
      id={id}
      mode="tags"
      open={false}
      suffixIcon={null}
      tokenSeparators={[',']}
      maxCount={10}
      value={value}
      onChange={onChange}
      placeholder={m.employer_workspace_search_tags_placeholder()}
    />
  )
}

/** Các trường lọc của Tìm CV; `value`/`onChange` là bản nháp, nút "Tìm CV" mới áp dụng. */
export default function CandidateFilters({ value, onChange }) {
  const id = useId()
  const set = (key) => (next) => onChange({ ...value, [key]: next })
  const setText = (key) => (event) => onChange({ ...value, [key]: event.target.value })
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces, staleTime: CATALOG_STALE })
  const categoriesQuery = useQuery({
    queryKey: ['job-categories', 'occupation-groups'],
    queryFn: () => getJobCategories(),
    staleTime: CATALOG_STALE,
    select: (items) => items
      .filter((item) => item.category_type === 'occupation_group')
      .map((item) => ({ value: item.id, label: item.name })),
  })
  const any = m.employer_workspace_search_any()

  return (
    <div className="cs-filters">
      <section className="cs-group" aria-labelledby={`${id}-keywords`}>
        <h3 id={`${id}-keywords`} className="cs-group__title">{m.employer_workspace_search_group_keywords()}</h3>
        <Field label={m.employer_workspace_search_keyword_label()} hint={m.employer_workspace_search_keyword_hint()} htmlFor={`${id}-q`}>
          <Input
            id={`${id}-q`}
            allowClear
            value={value.q}
            onChange={setText('q')}
            placeholder={m.employer_workspace_search_keyword_placeholder()}
          />
        </Field>
        <Field label={m.employer_workspace_search_all_keywords()} hint={m.employer_workspace_search_all_keywords_hint()} htmlFor={`${id}-all`}>
          <KeywordTags id={`${id}-all`} value={value.all_keywords} onChange={set('all_keywords')} />
        </Field>
        <Field label={m.employer_workspace_search_any_keywords()} hint={m.employer_workspace_search_any_keywords_hint()} htmlFor={`${id}-any`}>
          <KeywordTags id={`${id}-any`} value={value.any_keywords} onChange={set('any_keywords')} />
        </Field>
        <Field label={m.employer_workspace_search_none_keywords()} hint={m.employer_workspace_search_none_keywords_hint()} htmlFor={`${id}-none`}>
          <KeywordTags id={`${id}-none`} value={value.none_keywords} onChange={set('none_keywords')} />
        </Field>
      </section>

      <section className="cs-group" aria-labelledby={`${id}-profile`}>
        <h3 id={`${id}-profile`} className="cs-group__title">{m.employer_workspace_search_group_profile()}</h3>
        <Field label={m.employer_workspace_search_province()} hint={m.employer_workspace_search_province_hint()} htmlFor={`${id}-province`}>
          <Select
            id={`${id}-province`}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={provincesQuery.isPending}
            value={value.province}
            onChange={set('province')}
            placeholder={m.employer_workspace_search_all_provinces()}
            options={(provincesQuery.data || []).map((item) => ({ value: item.id, label: item.name }))}
          />
        </Field>
        <Field label={m.employer_workspace_search_category()} hint={m.employer_workspace_search_category_hint()} htmlFor={`${id}-category`}>
          <Select
            id={`${id}-category`}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={categoriesQuery.isPending}
            value={value.category}
            onChange={set('category')}
            placeholder={m.employer_workspace_search_all_categories()}
            options={categoriesQuery.data || []}
          />
        </Field>
        <Field label={m.employer_workspace_search_language()} htmlFor={`${id}-language`}>
          <div className="cs-pair">
            <Select
              id={`${id}-language`}
              allowClear
              value={value.language}
              onChange={(next) => onChange({ ...value, language: next, language_level: next ? value.language_level : undefined })}
              placeholder={any}
              options={LANGUAGES.map((code) => ({ value: code, label: languageLabel(code) }))}
            />
            <Select
              allowClear
              aria-label={m.employer_workspace_search_language_level()}
              disabled={!value.language}
              value={value.language_level}
              onChange={set('language_level')}
              placeholder={m.employer_workspace_search_language_level()}
              options={LANGUAGE_LEVELS.map((level) => ({
                value: level,
                label: m.employer_workspace_search_at_least({ level: languageLevelLabel(level) }),
              }))}
            />
          </div>
        </Field>
        <Field label={m.employer_workspace_search_years()} hint={m.employer_workspace_search_years_hint()} htmlFor={`${id}-min-years`}>
          <div className="cs-pair">
            <InputNumber
              id={`${id}-min-years`}
              min={0}
              max={50}
              value={value.min_years}
              onChange={set('min_years')}
              placeholder={m.employer_workspace_search_from()}
            />
            <InputNumber
              aria-label={m.employer_workspace_search_years_to()}
              min={0}
              max={50}
              value={value.max_years}
              onChange={set('max_years')}
              placeholder={m.employer_workspace_search_to()}
              status={value.min_years != null && value.max_years != null && value.max_years < value.min_years ? 'error' : undefined}
            />
          </div>
        </Field>
        <Field label={m.employer_workspace_search_position_level()} htmlFor={`${id}-position`}>
          <Select
            id={`${id}-position`}
            allowClear
            value={value.position_level}
            onChange={set('position_level')}
            placeholder={any}
            options={POSITION_LEVELS.map((level) => ({ value: level, label: positionLevelLabel(level) }))}
          />
        </Field>
        <Field label={m.employer_workspace_search_education()} htmlFor={`${id}-education`}>
          <Select
            id={`${id}-education`}
            allowClear
            value={value.education}
            onChange={set('education')}
            placeholder={any}
            options={EDUCATION_LEVELS.map((level) => ({
              value: level,
              label: m.employer_workspace_search_min_education({ level: educationLevelLabel(level) }),
            }))}
          />
        </Field>
        <Field label={m.employer_workspace_search_title_label()} hint={m.employer_workspace_search_title_hint()} htmlFor={`${id}-title`}>
          <Input
            id={`${id}-title`}
            allowClear
            value={value.title}
            onChange={setText('title')}
            placeholder={m.employer_workspace_search_title_placeholder()}
          />
        </Field>
        <Field label={m.employer_workspace_search_school()} htmlFor={`${id}-school`}>
          <Input
            id={`${id}-school`}
            allowClear
            value={value.school}
            onChange={setText('school')}
            placeholder={m.employer_workspace_search_school_placeholder()}
          />
        </Field>
      </section>
    </div>
  )
}
