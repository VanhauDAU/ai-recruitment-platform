import { useEffect, useState } from 'react'
import { Button, Form, Input, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { getProvinces } from '@/entities/location'
import { useConsultationSubmit } from '../model/use-consultation-submit'

const NEED_VALUES = ['post_job', 'buy_service', 'ai_solution', 'employer_branding', 'other']

export default function ConsultationForm({ initialValues, onSuccess }) {
  const { t } = useTranslation('employer')
  const [form] = Form.useForm()
  const [provinces, setProvinces] = useState([])
  const { submit, submitting } = useConsultationSubmit({
    onSuccess: () => {
      form.resetFields()
      onSuccess?.()
    },
  })

  useEffect(() => {
    let active = true
    getProvinces()
      .then((data) => { if (active) setProvinces(Array.isArray(data) ? data : []) })
      .catch(() => { if (active) setProvinces([]) })
    return () => { active = false }
  }, [])

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{ need: 'post_job', ...initialValues }}
      onFinish={submit}
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item
          name="full_name"
          label={t('consultation.fullName')}
          rules={[{ required: true, whitespace: true, message: t('consultation.required.fullName') }]}
        >
          <Input placeholder={t('consultation.fullNamePlaceholder')} maxLength={120} />
        </Form.Item>
        <Form.Item name="company_name" label={t('consultation.companyName')}>
          <Input placeholder={t('consultation.companyNamePlaceholder')} maxLength={200} />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('consultation.email')}
          rules={[
            { required: true, message: t('consultation.required.email') },
            { type: 'email', message: t('consultation.required.emailInvalid') },
          ]}
        >
          <Input placeholder="email@congty.vn" maxLength={254} />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('consultation.phone')}
          rules={[
            { required: true, message: t('consultation.required.phone') },
            { pattern: /^[0-9+ .()-]{8,20}$/, message: t('consultation.required.phoneInvalid') },
          ]}
        >
          <Input placeholder="0912 345 678" maxLength={20} />
        </Form.Item>
        <Form.Item name="province" label={t('consultation.province')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('consultation.provincePlaceholder')}
            options={provinces.map((p) => ({ value: p.name, label: p.name }))}
          />
        </Form.Item>
        <Form.Item name="need" label={t('consultation.need')}>
          <Select
            placeholder={t('consultation.needPlaceholder')}
            options={NEED_VALUES.map((value) => ({ value, label: t(`consultation.needOptions.${value}`) }))}
          />
        </Form.Item>
      </div>
      <Form.Item name="note" label={t('consultation.note')}>
        <Input.TextArea rows={3} maxLength={2000} placeholder={t('consultation.notePlaceholder')} />
      </Form.Item>

      <Button type="primary" htmlType="submit" size="large" shape="round" block loading={submitting}>
        {t('consultation.submit')}
      </Button>
      <p className="mt-3 text-center text-xs leading-5 text-gray-500">{t('consultation.consentNote')}</p>
    </Form>
  )
}
