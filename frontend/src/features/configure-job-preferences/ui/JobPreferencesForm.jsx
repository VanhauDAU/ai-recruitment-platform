import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, Checkbox, Form, Input, InputNumber, Radio, Select, Switch } from 'antd'
import { UnorderedListOutlined, UserOutlined } from '@ant-design/icons'
import { updateCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getJobCategories } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
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

const FIELD_LABELS = {
  desired_specialization_ids: 'Vị trí chuyên môn',
  desired_position_other: 'Vị trí chuyên môn khác',
  desired_salary_vnd: 'Mức lương',
  experience_level: 'Kinh nghiệm',
  preferred_province_ids: 'Địa điểm làm việc',
  willing_to_relocate: 'Khả năng thay đổi địa điểm làm việc',
  ai_recommendation_consent: 'Đồng ý nhận gợi ý việc làm',
  recruiter_visibility_consent: 'Đồng ý nhận thông tin việc làm và sự kiện',
}

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

export default function JobPreferencesForm({ preference, profile, onProfileSaved, onSaved, onSkip, submitLabel = 'Hoàn thành', variant = 'default', renderFooter }) {
  const [form] = Form.useForm()
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [provinces, setProvinces] = useState([])

  const isAccountSettings = variant === 'settings'

  const desiredSpecializationIds = Form.useWatch('desired_specialization_ids', form)
  const desiredSalaryVnd = Form.useWatch('desired_salary_vnd', form)
  const experienceLevel = Form.useWatch('experience_level', form)
  const preferredProvinceIds = Form.useWatch('preferred_province_ids', form)
  const gender = Form.useWatch('gender', form)

  const isValid = useMemo(() => {
    if (isAccountSettings && !gender) return false
    if (!desiredSpecializationIds || desiredSpecializationIds.length < 1 || desiredSpecializationIds.length > 5) return false
    if (desiredSalaryVnd == null || desiredSalaryVnd < 1) return false
    if (!experienceLevel) return false
    if (!preferredProvinceIds || preferredProvinceIds.length < 1) return false
    return true
  }, [isAccountSettings, gender, desiredSpecializationIds, desiredSalaryVnd, experienceLevel, preferredProvinceIds])

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
  }, [])

  useEffect(() => {
    form.setFieldsValue({ ...toFormValues(preference), gender: profile?.gender || undefined })
  }, [form, preference, profile])

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
      const { gender, ...preferenceValues } = values
      const [saved] = await Promise.all([
        updateCandidateJobPreferences({
          ...preferenceValues,
          desired_position_other: (values.desired_position_other || '').trim(),
          desired_salary_vnd: values.desired_salary_vnd ?? null,
          // These consent controls are intentionally hidden after being granted,
          // but the API still requires the boolean on every replacement PUT.
          ai_recommendation_consent: values.ai_recommendation_consent ?? Boolean(preference?.ai_recommendation_consent),
          recruiter_visibility_consent: values.recruiter_visibility_consent ?? Boolean(preference?.recruiter_visibility_consent),
        }),
        variant === 'settings' ? onProfileSaved?.({ gender }) : null,
      ])
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
          const [fieldName, errors] = entries[0]
          const firstError = [].concat(errors)[0]
          message.error(`Chưa thể cập nhật trường “${FIELD_LABELS[fieldName] || fieldName}”. ${firstError}`)
          return
        }
      }
      message.error(getApiErrorMessage(error, 'Không thể cập nhật nhu cầu công việc. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  function handleFinishFailed({ errorFields }) {
    const firstError = errorFields?.[0]?.errors?.[0]
    message.warning(firstError || 'Vui lòng hoàn thiện các thông tin bắt buộc trước khi cập nhật.')
  }

  const isOnboarding = variant === 'onboarding'

  const labelClassName = isOnboarding ? 'font-semibold text-slate-700' : 'font-semibold text-slate-800'
  const fieldClassName = isOnboarding ? '!mb-3' : undefined

  const footerNode = renderFooter
    ? renderFooter({ saving, catalogLoading, onSkip, isValid })
    : (
      <div className="mt-6 flex flex-wrap gap-3">
        {onSkip && <Button size="large" onClick={onSkip}>Tôi sẽ hoàn thiện sau</Button>}
        <Button type="primary" htmlType="submit" size="large" loading={saving} disabled={catalogLoading || !isValid}>{submitLabel}</Button>
      </div>
    )

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit} onFinishFailed={handleFinishFailed} className="space-y-1">
      {isAccountSettings && (
        <>
          <section className="border-b border-slate-100 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserOutlined /></span>Thông tin cá nhân</h2>
            <Form.Item name="gender" label={<span className={labelClassName}>Giới tính <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Vui lòng chọn giới tính.' }]} className="!mb-0 mt-3">
              <Radio.Group className="flex flex-wrap gap-x-7 gap-y-2">
                <Radio value="female">Nữ</Radio>
                <Radio value="male">Nam</Radio>
                <Radio value="unspecified">Không xác định</Radio>
              </Radio.Group>
            </Form.Item>
          </section>
          <h2 className="flex items-center gap-2 pt-1 text-sm font-bold text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UnorderedListOutlined /></span>Nhu cầu công việc</h2>
        </>
      )}
      <Form.Item
        name="desired_specialization_ids"
        label={<span className={labelClassName}>Vị trí chuyên môn (chọn tối đa 5 vị trí) <span className="text-red-500">*</span></span>}
        rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một vị trí chuyên môn.' }, { type: 'array', max: 5, message: 'Chỉ được chọn tối đa 5 vị trí chuyên môn.' }]}
        className={fieldClassName}
      >
        <JobSpecializationPicker categories={categories} disabled={catalogLoading} />
      </Form.Item>

      <Form.Item name="desired_position_other" label={<span className={isOnboarding || isAccountSettings ? 'text-sm italic text-slate-600' : labelClassName}>{isOnboarding || isAccountSettings ? 'Nhập vị trí chuyên môn không có trong danh mục (nhập tối đa 5 vị trí)' : 'Vị trí chuyên môn khác'}</span>} className={fieldClassName}>
        <AutoComplete options={specializationSuggestions} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} filterOption={(input, option) => option.value.toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}>
          <Input maxLength={255} allowClear placeholder="Nhập tên vị trí chuyên môn" className="!h-10 !rounded-xl" />
        </AutoComplete>
      </Form.Item>

      <div className={isOnboarding ? 'grid gap-x-4 sm:grid-cols-2' : undefined}>
        <Form.Item
          label={<span className={labelClassName}>{isAccountSettings ? 'Mức lương' : 'Mức lương mong muốn'} <span className="text-red-500">*</span></span>}
          required
          className={fieldClassName}
        >
          <div className="relative">
            <Form.Item
              name="desired_salary_vnd"
              noStyle
              rules={[{
                validator: (_, value) => {
                  if (value == null) return Promise.reject(new Error('Vui lòng nhập mức lương mong muốn.'))
                  if (value < 1) return Promise.reject(new Error('Mức lương phải lớn hơn 0.'))
                  return Promise.resolve()
                },
              }]}
            >
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
            </Form.Item>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
              {isAccountSettings ? 'VND' : 'VND / tháng'}
            </span>
          </div>
        </Form.Item>

        <Form.Item
          name="experience_level"
          label={<span className={labelClassName}>Kinh nghiệm <span className="text-red-500">*</span></span>}
          rules={[{ required: true, message: 'Vui lòng chọn kinh nghiệm.' }]}
          className={fieldClassName}
        >
          <Select options={EXPERIENCE_OPTIONS} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} placeholder="Chọn kinh nghiệm" className="!h-10 !w-full [&_.ant-select-selector]:!rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item
        name="preferred_province_ids"
        label={<span className={labelClassName}>Địa điểm làm việc <span className="text-red-500">*</span></span>}
        rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một tỉnh/thành.' }]}
        className={fieldClassName}
      >
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" loading={catalogLoading} options={provinceOptions} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} placeholder="Chọn tỉnh/thành" maxTagCount="responsive" className="!min-h-10 !w-full [&_.ant-select-selector]:!min-h-10 [&_.ant-select-selector]:!rounded-xl" />
      </Form.Item>

      {isOnboarding || isAccountSettings ? (
        <Form.Item name="willing_to_relocate" valuePropName="checked" className="!mb-2">
          <Checkbox>{isAccountSettings ? 'Tôi có thể thay đổi địa điểm làm việc' : 'Sẵn sàng thay đổi địa điểm làm việc nếu có cơ hội phù hợp'}</Checkbox>
        </Form.Item>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <Form.Item name="willing_to_relocate" valuePropName="checked" noStyle>
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>
          <span className="text-sm text-slate-700">Sẵn sàng thay đổi địa điểm làm việc</span>
        </div>
      )}

      <div className={isOnboarding || isAccountSettings ? 'space-y-2 text-sm text-slate-700' : 'space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700'}>
        {preference?.ai_recommendation_consent ? (
          <Form.Item name="ai_recommendation_consent" hidden>
            <Input />
          </Form.Item>
        ) : (
          <Form.Item name="ai_recommendation_consent" valuePropName="checked" className="!mb-0">
            <Checkbox>Đồng ý để ProCV gợi ý việc làm dựa trên CV và hoạt động tìm việc của tôi.</Checkbox>
          </Form.Item>
        )}
        {preference?.recruiter_visibility_consent ? (
          <Form.Item name="recruiter_visibility_consent" hidden>
            <Input />
          </Form.Item>
        ) : (
          <Form.Item name="recruiter_visibility_consent" valuePropName="checked" className="!mb-0">
            <Checkbox>Đồng ý để ProCV gửi thông tin liên quan đến việc làm, sự kiện nghề nghiệp.</Checkbox>
          </Form.Item>
        )}
      </div>

      {isOnboarding && <p className="mt-4 text-xs font-medium text-slate-500">(*) Thông tin bắt buộc</p>}

      {footerNode}
    </Form>
  )
}
