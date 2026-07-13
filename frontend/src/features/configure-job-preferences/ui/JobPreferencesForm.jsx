import { useEffect, useMemo, useState } from 'react'
import { App, AutoComplete, Button, Checkbox, Form, Input, InputNumber, Select, Switch } from 'antd'
import { updateCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getJobCategories } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import JobSpecializationPicker from './JobSpecializationPicker'

const EXPERIENCE_OPTIONS = [
  ['no_experience', 'Chưa có kinh nghiệm'],
  ['under_1', 'Dưới 1 năm'],
  ['1', '1 năm'],
  ['2', '2 năm'],
  ['3', '3 năm'],
  ['4', '4 năm'],
  ['5', '5 năm'],
  ['over_5', 'Trên 5 năm'],
].map(([value, label]) => ({ value, label }))

const DROPDOWN_CLASS_NAME = '!rounded-2xl !p-1 !shadow-lg [&_.ant-select-item-option]:!rounded-xl'

function toFormValues(preference) {
  return {
    desired_specialization_ids: preference?.desired_specializations?.map((item) => item.id) || [],
    desired_position_other: preference?.desired_position_other || '',
    desired_salary_vnd: preference?.desired_salary_vnd ?? null,
    experience_level: preference?.experience_level || undefined,
    preferred_province_ids: preference?.preferred_provinces?.map((item) => item.id) || [],
    willing_to_relocate: preference?.willing_to_relocate ?? false,
    ai_recommendation_consent: Boolean(preference?.ai_recommendation_consent),
    recruiter_visibility_consent: Boolean(preference?.recruiter_visibility_consent),
  }
}

export default function JobPreferencesForm({ preference, onSaved, onSkip, submitLabel = 'Hoàn thành', variant = 'default', renderFooter }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [provinces, setProvinces] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([getJobCategories(), getProvinces()])
      .then(([categoryData, provinceData]) => {
        if (!active) return
        setCategories(categoryData)
        setProvinces(provinceData)
      })
      .catch(() => {
        if (active) message.error('Không tải được danh mục. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    return () => { active = false }
  }, [message])

  useEffect(() => {
    form.setFieldsValue(toFormValues(preference))
  }, [form, preference])

  const provinceOptions = useMemo(
    () => provinces.map((province) => ({ value: province.id, label: province.name })),
    [provinces],
  )
  const specializationSuggestions = useMemo(
    () => categories
      .filter((category) => category.category_type === 'specialization')
      .map((category) => ({ value: category.name })),
    [categories],
  )

  async function handleSubmit(values) {
    setSaving(true)
    try {
      const saved = await updateCandidateJobPreferences({
        ...values,
        desired_position_other: (values.desired_position_other || '').trim(),
        desired_salary_vnd: values.desired_salary_vnd ?? null,
      })
      message.success('Đã lưu nhu cầu công việc của bạn.')
      onSaved?.(saved)
    } catch (error) {
      const fieldErrors = error?.response?.data
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const entries = Object.entries(fieldErrors).filter(([name]) => [
          'desired_specialization_ids', 'desired_position_other', 'desired_salary_vnd',
          'experience_level', 'preferred_province_ids', 'willing_to_relocate',
          'ai_recommendation_consent', 'recruiter_visibility_consent',
        ].includes(name))
        if (entries.length) {
          form.setFields(entries.map(([name, errors]) => ({ name, errors: [].concat(errors) })))
          return
        }
      }
      message.error(getApiErrorMessage(error, 'Không thể lưu nhu cầu công việc. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const isOnboarding = variant === 'onboarding'

  const labelClassName = isOnboarding ? 'font-semibold text-slate-700' : 'font-semibold text-slate-800'
  const fieldClassName = isOnboarding ? '!mb-3' : undefined

  const footerNode = renderFooter
    ? renderFooter({ saving, catalogLoading, onSkip })
    : (
      <div className="mt-6 flex flex-wrap gap-3">
        {onSkip && <Button size="large" onClick={onSkip}>Tôi sẽ hoàn thiện sau</Button>}
        <Button type="primary" htmlType="submit" size="large" loading={saving} disabled={catalogLoading}>{submitLabel}</Button>
      </div>
    )

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit} className="space-y-1">
      <Form.Item
        name="desired_specialization_ids"
        label={<span className={labelClassName}>Vị trí chuyên môn (chọn tối đa 5 vị trí) <span className="text-red-500">*</span></span>}
        rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một vị trí chuyên môn.' }, { type: 'array', max: 5, message: 'Chỉ được chọn tối đa 5 vị trí chuyên môn.' }]}
        className={fieldClassName}
      >
        <JobSpecializationPicker categories={categories} disabled={catalogLoading} />
      </Form.Item>

      <Form.Item name="desired_position_other" label={<span className={isOnboarding ? 'text-sm italic text-slate-600' : labelClassName}>{isOnboarding ? 'Nhập vị trí chuyên môn không có trong danh mục' : 'Vị trí chuyên môn khác'}</span>} className={fieldClassName}>
        <AutoComplete options={specializationSuggestions} popupClassName={DROPDOWN_CLASS_NAME} filterOption={(input, option) => option.value.toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}>
          <Input maxLength={255} allowClear placeholder="Nhập tên vị trí chuyên môn" className="!h-10 !rounded-xl" />
        </AutoComplete>
      </Form.Item>

      <div className={isOnboarding ? 'grid gap-x-4 sm:grid-cols-2' : undefined}>
        <Form.Item
          name="desired_salary_vnd"
          label={<span className={labelClassName}>Mức lương mong muốn <span className="text-red-500">*</span></span>}
          rules={[{
            validator: (_, value) => {
              if (value == null) return Promise.reject(new Error('Vui lòng nhập mức lương mong muốn.'))
              if (value < 1) return Promise.reject(new Error('Mức lương phải lớn hơn 0.'))
              return Promise.resolve()
            },
          }]}
          className={fieldClassName}
        >
          <div className="relative">
            <InputNumber
              controls={false}
              className="!h-10 !w-full !rounded-xl [&_.ant-input-number-input]:!pr-[7.5rem]"
              min={1}
              precision={0}
              inputMode="numeric"
              placeholder="0"
              formatter={(value) => (value == null || value === '' ? '' : new Intl.NumberFormat('vi-VN').format(value))}
              parser={(value) => {
                const num = Number(String(value || '').replace(/[^\d]/g, ''))
                return num > 0 ? num : null
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
              VND / tháng
            </span>
          </div>
        </Form.Item>

        <Form.Item
          name="experience_level"
          label={<span className={labelClassName}>Kinh nghiệm <span className="text-red-500">*</span></span>}
          rules={[{ required: true, message: 'Vui lòng chọn kinh nghiệm.' }]}
          className={fieldClassName}
        >
          <Select options={EXPERIENCE_OPTIONS} popupClassName={DROPDOWN_CLASS_NAME} placeholder="Chọn kinh nghiệm" className="!h-10 !w-full [&_.ant-select-selector]:!rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item
        name="preferred_province_ids"
        label={<span className={labelClassName}>Địa điểm làm việc <span className="text-red-500">*</span></span>}
        rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một tỉnh/thành.' }]}
        className={fieldClassName}
      >
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" loading={catalogLoading} options={provinceOptions} popupClassName={DROPDOWN_CLASS_NAME} placeholder="Chọn tỉnh/thành" maxTagCount="responsive" className="!min-h-10 !w-full [&_.ant-select-selector]:!min-h-10 [&_.ant-select-selector]:!rounded-xl" />
      </Form.Item>

      {isOnboarding ? (
        <Form.Item name="willing_to_relocate" valuePropName="checked" className="!mb-2">
          <Checkbox>Sẵn sàng thay đổi địa điểm làm việc nếu có cơ hội phù hợp</Checkbox>
        </Form.Item>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <Form.Item name="willing_to_relocate" valuePropName="checked" noStyle>
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>
          <span className="text-sm text-slate-700">Sẵn sàng thay đổi địa điểm làm việc</span>
        </div>
      )}

      <div className={isOnboarding ? 'space-y-2 text-sm text-slate-700' : 'space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700'}>
        <Form.Item name="ai_recommendation_consent" valuePropName="checked" className="!mb-0">
          <Checkbox>Đồng ý để ProCV gợi ý việc làm dựa trên CV và hoạt động tìm việc của tôi.</Checkbox>
        </Form.Item>
        <Form.Item name="recruiter_visibility_consent" valuePropName="checked" className="!mb-0">
          <Checkbox>Đồng ý để ProCV gửi thông tin liên quan đến việc làm, sự kiện nghề nghiệp.</Checkbox>
        </Form.Item>
      </div>

      {isOnboarding && <p className="mt-4 text-xs font-medium text-slate-500">(*) Thông tin bắt buộc</p>}

      {footerNode}
    </Form>
  )
}
