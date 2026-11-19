import { Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'

const FALLBACK_MAX_DEADLINE_DAYS = 90

export default function ApplicationInfoFields({
  campaigns,
  creatingCampaign,
  maxDeadlineDays = FALLBACK_MAX_DEADLINE_DAYS,
  onCreateCampaign,
}) {
  const form = Form.useFormInstance()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateForm] = Form.useForm()
  const today = dayjs().startOf('day')
  const normalizedMaxDays = Number.isInteger(maxDeadlineDays) && maxDeadlineDays > 0
    ? maxDeadlineDays
    : FALLBACK_MAX_DEADLINE_DAYS
  const latestDeadline = today.add(normalizedMaxDays, 'day')

  function validateDeadline(_, deadline) {
    if (!deadline) return Promise.resolve()
    if (deadline.isBefore(today, 'day')) {
      return Promise.reject(new Error(m.employer_job_form_deadline_past()))
    }
    if (deadline.isAfter(latestDeadline, 'day')) {
      return Promise.reject(
        new Error(m.employer_job_form_deadline_too_far({ days: normalizedMaxDays })),
      )
    }
    return Promise.resolve()
  }

  async function createQuickCampaign({ name }) {
    const campaign = await onCreateCampaign(name.trim())
    form.setFieldValue('campaign', campaign.public_id)
    quickCreateForm.resetFields()
    setQuickCreateOpen(false)
  }

  return (
    <>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item
          name="deadline"
          label={m.employer_job_form_deadline()}
          extra={m.employer_job_form_deadline_extra({ date: latestDeadline.format('DD/MM/YYYY'), days: normalizedMaxDays })}
          rules={[
            { required: true, message: m.employer_job_form_deadline_required() },
            { validator: validateDeadline },
          ]}
        >
          <DatePicker
            className="!w-full"
            disabledDate={(date) => date && (
              date.isBefore(today, 'day') || date.isAfter(latestDeadline, 'day')
            )}
            format="DD/MM/YYYY"
            placeholder={m.employer_job_form_deadline_placeholder()}
          />
        </Form.Item>
        <Form.Item name="number_of_vacancies" label={m.employer_job_form_vacancies()} rules={[{ required: true, type: 'number', min: 1, message: m.employer_job_form_vacancies_error() }]}>
          <InputNumber min={1} className="!w-full" placeholder={m.employer_job_form_vacancies_placeholder()} />
        </Form.Item>
      </div>
      <Form.Item name="campaign" label={m.employer_job_form_campaign()}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          options={campaigns.map((item) => ({ value: item.public_id, label: item.name }))}
          placeholder={m.employer_job_form_campaign_placeholder()}
        />
      </Form.Item>
      <Button type="link" className="!mb-4 !px-0" onClick={() => setQuickCreateOpen(true)}>
        {m.employer_job_form_quick_campaign_link()}
      </Button>
      <Modal
        destroyOnHidden
        open={quickCreateOpen}
        title={m.employer_job_form_quick_campaign_title()}
        okText={m.employer_job_form_quick_campaign_ok()}
        cancelText={m.employer_job_form_cancel()}
        confirmLoading={creatingCampaign}
        onCancel={() => setQuickCreateOpen(false)}
        onOk={() => quickCreateForm.submit()}
      >
        <Form form={quickCreateForm} layout="vertical" onFinish={createQuickCampaign}>
          <Form.Item name="name" label={m.employer_job_form_campaign_name()} rules={[{ required: true, whitespace: true, message: m.employer_job_form_campaign_name_required() }]}>
            <Input autoFocus maxLength={255} placeholder={m.employer_job_form_campaign_name_placeholder()} />
          </Form.Item>
        </Form>
      </Modal>
      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-extrabold text-slate-800">{m.employer_job_form_recipient()}</h3>
        <div className="mt-3 grid gap-x-4 md:grid-cols-2">
          <Form.Item name={['application_contact', 'recipient_name']} label={m.employer_job_form_recipient_name()} rules={[{ required: true, whitespace: true, message: m.employer_job_form_recipient_name_required() }]}>
            <Input maxLength={255} placeholder={m.employer_job_form_recipient_name_placeholder()} />
          </Form.Item>
          <Form.Item
            name={['application_contact', 'phone']}
            label={m.employer_job_form_phone()}
            rules={[
              { required: true, whitespace: true, message: m.employer_job_form_phone_required() },
              { pattern: /^[+\d][\d\s().-]{7,29}$/, message: m.employer_job_form_phone_invalid() },
            ]}
          >
            <Input maxLength={30} placeholder={m.employer_job_form_phone_placeholder()} />
          </Form.Item>
        </div>
        <Form.Item
          className="!mb-0"
          name={['application_contact', 'emails']}
          label={m.employer_job_form_emails()}
          rules={[
            { required: true, type: 'array', min: 1, message: m.employer_job_form_emails_required() },
            {
              validator(_, emails = []) {
                if (emails.length > 5) return Promise.reject(new Error(m.employer_job_form_emails_too_many()))
                const valid = emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return valid ? Promise.resolve() : Promise.reject(new Error(m.employer_job_form_emails_invalid()))
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[',', ' ']} maxCount={5} placeholder={m.employer_job_form_emails_placeholder()} open={false} />
        </Form.Item>
      </div>
    </>
  )
}
