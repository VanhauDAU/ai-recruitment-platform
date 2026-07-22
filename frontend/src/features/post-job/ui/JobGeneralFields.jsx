import { Checkbox, Form, Input, InputNumber, Select } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
} from '@/entities/job'
import { capitalizeTitleWords } from '../model/job-form-values'
import JobSpecializationCascader from './JobSpecializationCascader'

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const CREATE_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'seasonal', 'work_from_home', 'internship', 'other']
const INCOME_LABEL_OPTIONS = [
  { value: 'income', label: 'Thu nhập' },
  { value: 'income_at_kpi', label: 'Thu nhập khi đạt 100% KPI' },
]
const formatAmount = (value) => (value === null || value === undefined || value === '' ? '' : `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
const parseAmount = (value) => (value || '').replace(/\./g, '')

export default function JobGeneralFields({ form, categories }) {
  const salaryType = Form.useWatch('salary_type', form)
  const incomeDisplayType = Form.useWatch('income_display_type', form) || 'income'
  const showsSalaryMinimum = ['range', 'fixed', 'from'].includes(salaryType)
  const showsSalaryMaximum = ['range', 'up_to'].includes(salaryType)
  const domainOptions = categories
    .filter((item) => item.category_type === 'domain')
    .map((item) => ({ value: item.id, label: item.name }))

  return (
    <>
      <Form.Item
        name="title"
        label="Tiêu đề tin"
        normalize={capitalizeTitleWords}
        rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề tin tuyển dụng.' }]}
      >
        <Input showCount maxLength={50} placeholder="Ví dụ: Kỹ sư Backend Java - Thu nhập đến 35 triệu" />
      </Form.Item>
      <Form.Item
        name={['category_assignments', 0, 'category']}
        label="Vị trí chuyên môn"
        rules={[{ required: true, message: 'Chọn vị trí chuyên môn.' }]}
      >
        <JobSpecializationCascader
          categories={categories}
          placeholder="Chọn Nhóm nghề / Nghề / Vị trí chuyên môn"
        />
      </Form.Item>
      <Form.Item name="domain_category_ids" label="Kiến thức chuyên ngành">
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          maxTagCount="responsive"
          options={domainOptions}
          placeholder="Có thể chọn nhiều chuyên ngành"
        />
      </Form.Item>
      <Form.Item name="position_level" label="Cấp bậc" rules={[{ required: true, message: 'Chọn cấp bậc.' }]}>
        <Select options={toOptions(POSITION_LEVEL_LABELS)} placeholder="-- Chọn cấp bậc --" />
      </Form.Item>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="employment_type" label="Loại công việc" rules={[{ required: true, message: 'Chọn loại công việc.' }]}>
          <Select options={CREATE_EMPLOYMENT_TYPES.map((value) => ({ value, label: EMPLOYMENT_TYPE_LABELS[value] }))} placeholder="-- Chọn loại công việc --" />
        </Form.Item>
        <Form.Item name="work_types" label="Hình thức làm việc" rules={[{ required: true, message: 'Chọn ít nhất một hình thức làm việc.' }]}>
          <Select mode="multiple" maxTagCount={1} className="post-job-oneline-select" options={toOptions(WORK_TYPE_LABELS)} placeholder="Có thể chọn nhiều hình thức" />
        </Form.Item>
      </div>
      <Form.Item name="salary_type" hidden><Input /></Form.Item>
      <div className="border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Form.Item name="income_display_type" noStyle>
            <Select
              aria-label="Cách hiển thị thu nhập"
              className="w-[230px]"
              size="small"
              options={INCOME_LABEL_OPTIONS}
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
            Thỏa thuận
          </Checkbox>
        </div>
        {salaryType !== 'negotiable' && (
          <div className="mt-3 flex flex-wrap gap-x-4">
            {showsSalaryMinimum && (
              <Form.Item
                name="salary_min"
                label={salaryType === 'fixed' ? 'Mức thu nhập' : incomeDisplayType === 'income_at_kpi' ? 'Từ mức thu nhập' : 'Từ mức'}
                rules={salaryType === 'range' ? [] : [{ required: true, message: 'Nhập mức lương.' }]}
              >
                <InputNumber min={0} step={1_000_000} className="!w-[210px]" suffix="VND" formatter={formatAmount} parser={parseAmount} placeholder="10.000.000" />
              </Form.Item>
            )}
            {showsSalaryMaximum && (
              <Form.Item
                name="salary_max"
                label="Đến mức"
                dependencies={['salary_min']}
                rules={[
                  ...(salaryType === 'range' ? [] : [{ required: true, message: 'Nhập mức lương tối đa.' }]),
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const minimum = getFieldValue('salary_min')
                      if (salaryType === 'range' && minimum == null && value == null) {
                        return Promise.reject(new Error('Nhập ít nhất một mức lương.'))
                      }
                      if (salaryType !== 'range' || value == null || minimum == null || value >= minimum) return Promise.resolve()
                      return Promise.reject(new Error('Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.'))
                    },
                  }),
                ]}
              >
                <InputNumber min={0} step={1_000_000} className="!w-[210px]" suffix="VND" formatter={formatAmount} parser={parseAmount} placeholder="30.000.000" />
              </Form.Item>
            )}
          </div>
        )}
      </div>
    </>
  )
}
