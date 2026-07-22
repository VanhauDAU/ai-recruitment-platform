import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, InputNumber, Select, message } from 'antd'
import { useState } from 'react'
import {
  EDUCATION_LEVEL_LABELS,
  EXPERIENCE_YEARS_LABELS,
  getSkills,
  jobKeys,
} from '@/entities/job'

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const PROFICIENCY_OPTIONS = [
  { value: 'basic', label: 'Cơ bản' },
  { value: 'conversational', label: 'Giao tiếp' },
  { value: 'working', label: 'Sử dụng trong công việc' },
  { value: 'professional', label: 'Thành thạo' },
  { value: 'native', label: 'Bản ngữ' },
]

function SkillMultiSelect({ value = [], onChange, options, placeholder, onCreateSkill, disabledSkillIds = [] }) {
  const [searchValue, setSearchValue] = useState('')
  const [creating, setCreating] = useState(false)
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
      message.error('Không thể thêm kỹ năng. Vui lòng thử lại.')
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
      maxTagCount="responsive"
      options={mergedOptions}
      placeholder={placeholder}
      searchValue={searchValue}
      onSearch={setSearchValue}
      onChange={onChange}
      dropdownRender={(menu) => (
        <>
          {menu}
          {normalizedSearch && !hasExactMatch && !searchQuery.isFetching && (
            <div className="border-t border-slate-100 p-1.5" onMouseDown={(event) => event.preventDefault()}>
              <Button type="text" size="small" className="!w-full !justify-start !text-emerald-600" loading={creating} onClick={addSkill}>
                + Thêm kỹ năng “{normalizedSearch}”
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
        <Form.Item name="education_level" label="Học vấn tối thiểu" rules={[{ required: true, message: 'Chọn yêu cầu học vấn.' }]}>
          <Select options={toOptions(EDUCATION_LEVEL_LABELS)} placeholder="-- Chọn học vấn --" />
        </Form.Item>
        <Form.Item name="experience_years" label="Số năm kinh nghiệm" rules={[{ required: true, message: 'Chọn kinh nghiệm.' }]}>
          <Select options={toOptions(EXPERIENCE_YEARS_LABELS)} placeholder="-- Chọn kinh nghiệm --" />
        </Form.Item>
      </div>
      <div className="grid gap-x-4 md:grid-cols-3">
        <Form.Item name="gender_requirement" label="Giới tính">
          <Select options={[
            { value: 'any', label: 'Không yêu cầu' },
            { value: 'male', label: 'Nam' },
            { value: 'female', label: 'Nữ' },
          ]} placeholder="-- Chọn giới tính --" />
        </Form.Item>
        <Form.Item name="age_min" label="Độ tuổi từ" rules={[{ type: 'number', min: 15, max: 100, message: 'Nhập tuổi từ 15 đến 100.' }]}> 
          <InputNumber min={15} max={100} className="!w-full" placeholder="Ví dụ: 18" />
        </Form.Item>
        <Form.Item
          name="age_max"
          label="Đến tuổi"
          dependencies={['age_min']}
          rules={[
            { type: 'number', min: 15, max: 100, message: 'Nhập tuổi từ 15 đến 100.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const minimum = getFieldValue('age_min')
                if (value == null || minimum == null || value >= minimum) return Promise.resolve()
                return Promise.reject(new Error('Tuổi tối đa không được nhỏ hơn tuổi tối thiểu.'))
              },
            }),
          ]}
        >
          <InputNumber min={15} max={100} className="!w-full" placeholder="Ví dụ: 35" />
        </Form.Item>
      </div>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="required_skill_ids" label="Kỹ năng cần có">
          <SkillMultiSelect options={skillOptions} placeholder="Chọn hoặc nhập kỹ năng bắt buộc" onCreateSkill={onCreateSkill} />
        </Form.Item>
        <Form.Item name="preferred_skill_ids" label="Kỹ năng nên có">
          <SkillMultiSelect options={preferredSkillOptions} placeholder="Chọn hoặc nhập kỹ năng ưu tiên" onCreateSkill={onCreateSkill} disabledSkillIds={requiredSkillIds} />
        </Form.Item>
      </div>

      <div className="mb-2 text-sm font-semibold text-slate-700">Ngoại ngữ</div>
      <Form.List name="language_requirements">
        {(fields, { add, remove }) => (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.key} className="border-t border-slate-200 pt-3">
                <div className="grid gap-x-3 md:grid-cols-[1fr_1fr_auto]">
                  <Form.Item name={[field.name, 'language']} label={`Ngoại ngữ ${index + 1}`} rules={[{ required: true, message: 'Chọn ngoại ngữ.' }]}> 
                    <Select showSearch optionFilterProp="label" options={languages.map((item) => ({ value: item.id, label: item.name }))} placeholder="-- Chọn ngoại ngữ --" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'proficiency_level']} label="Trình độ/Chứng chỉ ngoại ngữ">
                    <Select allowClear options={PROFICIENCY_OPTIONS} placeholder="-- Chọn trình độ/chứng chỉ --" />
                  </Form.Item>
                  <Button className="self-center md:mt-2" danger type="text" icon={<DeleteOutlined />} aria-label={`Xóa ngoại ngữ ${index + 1}`} onClick={() => remove(field.name)} />
                </div>
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ sort_order: fields.length })}>
              Thêm ngoại ngữ
            </Button>
          </div>
        )}
      </Form.List>
    </>
  )
}
