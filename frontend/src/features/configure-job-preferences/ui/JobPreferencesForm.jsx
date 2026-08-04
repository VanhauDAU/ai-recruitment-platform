import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, Checkbox, Form, Input, InputNumber, Radio, Select, Switch } from 'antd'
import { UnorderedListOutlined, UserOutlined } from '@ant-design/icons'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { EXPERIENCE_OPTIONS, toFormValues } from '../model/job-preferences-fields'
import { jobPreferenceFieldErrors, saveJobPreferences } from '../model/save-job-preferences'
import { useJobPreferenceCatalog } from '../model/use-job-preference-catalog'
import JobSpecializationPicker from './JobSpecializationPicker'

const DROPDOWN_CLASS_NAME = '!rounded-2xl !p-1 !shadow-lg [&_.ant-select-item-option]:!rounded-xl'

export default function JobPreferencesForm({ preference, profile, onProfileSaved, onSaved, onSkip, submitLabel = 'Hoàn thành', variant = 'default', renderFooter }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const {
    categories,
    loading: catalogLoading,
    provinceOptions,
    specializationSuggestions,
  } = useJobPreferenceCatalog()

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
    form.setFieldsValue({ ...toFormValues(preference), gender: profile?.gender || undefined })
  }, [form, preference, profile])

  async function handleSubmit(values) {
    setSaving(true)
    try {
      const { gender, ...preferenceValues } = values
      const [saved] = await Promise.all([
        saveJobPreferences(preferenceValues, preference),
        variant === 'settings' ? onProfileSaved?.({ gender }) : null,
      ])
      message.success('Đã lưu nhu cầu công việc của bạn.')
      onSaved?.(saved)
    } catch (error) {
      const fieldErrors = jobPreferenceFieldErrors(error)
      if (fieldErrors.length) {
        form.setFields(fieldErrors.map(({ name, errors }) => ({ name, errors })))
        const [{ errors, label }] = fieldErrors
        message.error(`Chưa thể cập nhật trường “${label}”. ${errors[0]}`)
        return
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

  const labelClassName = 'font-semibold text-slate-800'

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
      >
        <JobSpecializationPicker categories={categories} disabled={catalogLoading} />
      </Form.Item>

      <Form.Item name="desired_position_other" label={<span className={isAccountSettings ? 'text-sm italic text-slate-600' : labelClassName}>{isAccountSettings ? 'Nhập vị trí chuyên môn không có trong danh mục (nhập tối đa 5 vị trí)' : 'Vị trí chuyên môn khác'}</span>}>
        <AutoComplete options={specializationSuggestions} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} filterOption={(input, option) => option.value.toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}>
          <Input maxLength={255} allowClear placeholder="Nhập tên vị trí chuyên môn" className="!h-10 !rounded-xl" />
        </AutoComplete>
      </Form.Item>

      <div>
        <Form.Item
          label={<span className={labelClassName}>{isAccountSettings ? 'Mức lương' : 'Mức lương mong muốn'} <span className="text-red-500">*</span></span>}
          required
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
        >
          <Select options={EXPERIENCE_OPTIONS} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} placeholder="Chọn kinh nghiệm" className="!h-10 !w-full [&_.ant-select-selector]:!rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item
        name="preferred_province_ids"
        label={<span className={labelClassName}>Địa điểm làm việc <span className="text-red-500">*</span></span>}
        rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một tỉnh/thành.' }]}
      >
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" loading={catalogLoading} options={provinceOptions} classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }} placeholder="Chọn tỉnh/thành" maxTagCount="responsive" className="!min-h-10 !w-full [&_.ant-select-selector]:!min-h-10 [&_.ant-select-selector]:!rounded-xl" />
      </Form.Item>

      {isAccountSettings ? (
        <Form.Item name="willing_to_relocate" valuePropName="checked" className="!mb-2">
          <Checkbox>Tôi có thể thay đổi địa điểm làm việc</Checkbox>
        </Form.Item>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <Form.Item name="willing_to_relocate" valuePropName="checked" noStyle>
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>
          <span className="text-sm text-slate-700">Sẵn sàng thay đổi địa điểm làm việc</span>
        </div>
      )}

      <div className={isAccountSettings ? 'space-y-2 text-sm text-slate-700' : 'space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700'}>
        <Form.Item name="ai_recommendation_consent" valuePropName="checked" className="!mb-0">
          <Checkbox>Đồng ý để hệ thống gợi ý việc làm dựa trên nhu cầu công việc và CV của tôi.</Checkbox>
        </Form.Item>
        <Form.Item name="recruiter_visibility_consent" valuePropName="checked" className="!mb-0">
          <Checkbox>
            Đồng ý cho phép nhà tuyển dụng tìm thấy và xem thông tin hồ sơ/CV của tôi.
          </Checkbox>
        </Form.Item>
      </div>

      {footerNode}
    </Form>
  )
}
