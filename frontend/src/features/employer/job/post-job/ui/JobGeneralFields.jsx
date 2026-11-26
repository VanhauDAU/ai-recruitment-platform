import { Checkbox, Form, Input, InputNumber, Select } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  SALARY_CURRENCY_OPTIONS,
  WORK_TYPE_LABELS,
} from '@/entities/job/job'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { capitalizeTitleWords } from '../model/job-form-values'
import JobSpecializationCascader from './JobSpecializationCascader'
import { m } from '@/shared/config/i18n'

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const CREATE_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'seasonal', 'work_from_home', 'internship', 'other']
const INCOME_LABEL_OPTIONS = [
  { value: 'income', label: m.employer_job_form_income() },
  { value: 'income_at_kpi', label: m.employer_job_form_income_at_kpi() },
]
const formatAmount = (value) => (value === null || value === undefined || value === '' ? '' : `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
const parseAmount = (value) => (value || '').replace(/\./g, '')

export default function JobGeneralFields({ form, categories }) {
  const salaryType = Form.useWatch('salary_type', form)
  const incomeDisplayType = Form.useWatch('income_display_type', form) || 'income'
  const currency = Form.useWatch('currency', form) || 'VND'
  // Điện thoại hiện đủ mọi lựa chọn đã chọn thay vì gom thành "+N" khó kiểm tra.
  const isPhone = useMediaQuery('(max-width: 639px)')
  const showsSalaryMinimum = ['range', 'fixed', 'from'].includes(salaryType)
  const showsSalaryMaximum = ['range', 'up_to'].includes(salaryType)
  const domainOptions = categories
    .filter((item) => item.category_type === 'domain')
    .map((item) => ({ value: item.id, label: item.name }))

  return (
    <>
      <Form.Item
        name="title"
        label={m.employer_job_progress_title()}
        normalize={capitalizeTitleWords}
        rules={[{ required: true, whitespace: true, message: m.employer_job_form_title_required() }]}
      >
        <Input
          showCount
          maxLength={255}
          placeholder={m.employer_job_form_title_placeholder()}
        />
      </Form.Item>
      <Form.Item
        name={['category_assignments', 0, 'category']}
        label={m.employer_job_progress_category()}
        rules={[{ required: true, message: m.employer_job_form_category_required() }]}
      >
        <JobSpecializationCascader
          categories={categories}
          placeholder={m.employer_job_form_category_placeholder()}
        />
      </Form.Item>
      <Form.Item name="domain_category_ids" label={m.employer_job_form_domains()}>
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          maxTagCount={isPhone ? undefined : 'responsive'}
          options={domainOptions}
          placeholder={m.employer_job_form_domains_placeholder()}
        />
      </Form.Item>
      <Form.Item name="position_level" label={m.employer_job_progress_level()} rules={[{ required: true, message: m.employer_job_form_level_required() }]}>
        <Select options={toOptions(POSITION_LEVEL_LABELS)} placeholder={m.employer_job_form_level_placeholder()} />
      </Form.Item>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="employment_type" label={m.employer_job_progress_employment_type()} rules={[{ required: true, message: m.employer_job_form_employment_type_required() }]}>
          <Select options={CREATE_EMPLOYMENT_TYPES.map((value) => ({ value, label: EMPLOYMENT_TYPE_LABELS[value] }))} placeholder={m.employer_job_form_employment_type_placeholder()} />
        </Form.Item>
        <Form.Item name="work_types" label={m.employer_job_progress_work_type()} rules={[{ required: true, message: m.employer_job_form_work_types_required() }]}>
          <Select mode="multiple" maxTagCount={isPhone ? undefined : 1} className="post-job-oneline-select" options={toOptions(WORK_TYPE_LABELS)} placeholder={m.employer_job_form_work_types_placeholder()} />
        </Form.Item>
      </div>
      <Form.Item name="salary_type" hidden><Input /></Form.Item>
      <div className="border-t border-slate-200 pt-4">
        <div className="post-job-salary-options flex flex-wrap items-center gap-x-4 gap-y-2">
          <Form.Item name="income_display_type" noStyle>
            <Select
              aria-label={m.employer_job_form_income_display_aria()}
              className="w-[230px]"
              size="small"
              options={INCOME_LABEL_OPTIONS}
            />
          </Form.Item>
          <Form.Item name="currency" noStyle>
            <Select
              aria-label={m.employer_job_form_currency_aria()}
              className="w-[112px]"
              size="small"
              options={SALARY_CURRENCY_OPTIONS}
            />
          </Form.Item>
          <Checkbox
            checked={salaryType === 'negotiable'}
            onChange={(event) => {
              form.setFieldValue('salary_type', event.target.checked ? 'negotiable' : 'range')
              if (event.target.checked) {
                form.setFieldValue('salary_min', null)
                form.setFieldValue('salary_max', null)
              }
            }}
          >
            {m.employer_job_form_negotiable()}
          </Checkbox>
        </div>
        {salaryType !== 'negotiable' && (
          <div className="post-job-salary-amounts mt-3 flex flex-wrap gap-x-4">
            {showsSalaryMinimum && (
              <Form.Item
                name="salary_min"
                label={salaryType === 'fixed' ? m.employer_job_form_salary_fixed() : incomeDisplayType === 'income_at_kpi' ? m.employer_job_form_salary_from_income() : m.employer_job_form_salary_from()}
                rules={salaryType === 'range' ? [] : [{ required: true, message: m.employer_job_form_salary_required() }]}
              >
                <InputNumber inputMode="numeric" min={0} step={currency === 'VND' ? 1_000_000 : 100} className="post-job-salary-input" suffix={currency} formatter={formatAmount} parser={parseAmount} placeholder={currency === 'VND' ? '10.000.000' : '1,000'} />
              </Form.Item>
            )}
            {showsSalaryMaximum && (
              <Form.Item
                name="salary_max"
                label={m.employer_job_form_salary_to()}
                dependencies={['salary_min']}
                rules={[
                  ...(salaryType === 'range' ? [] : [{ required: true, message: m.employer_job_form_salary_max_required() }]),
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const minimum = getFieldValue('salary_min')
                      if (salaryType === 'range' && minimum == null && value == null) {
                        return Promise.reject(new Error(m.employer_job_form_salary_any_required()))
                      }
                      if (salaryType !== 'range' || value == null || minimum == null || value >= minimum) return Promise.resolve()
                      return Promise.reject(new Error(m.employer_job_form_salary_max_too_low()))
                    },
                  }),
                ]}
              >
                <InputNumber inputMode="numeric" min={0} step={currency === 'VND' ? 1_000_000 : 100} className="post-job-salary-input" suffix={currency} formatter={formatAmount} parser={parseAmount} placeholder={currency === 'VND' ? '30.000.000' : '2,000'} />
              </Form.Item>
            )}
          </div>
        )}
      </div>
    </>
  )
}
