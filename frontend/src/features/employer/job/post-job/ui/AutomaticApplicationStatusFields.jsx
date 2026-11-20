import { MailOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Form, Input, Select, Switch } from 'antd'
import { useEffect } from 'react'
import { useApplicationRules } from '@/entities/application/application'
import { m } from '@/shared/config/i18n'

export default function AutomaticApplicationStatusFields() {
  const form = Form.useFormInstance()
  const enabled = Form.useWatch('auto_reject_stale_applications', form)
  const rules = useApplicationRules()
  const defaultDays = rules?.auto_reject_default_days

  useEffect(() => {
    if (defaultDays && form.getFieldValue('auto_reject_after_days') == null) {
      form.setFieldValue('auto_reject_after_days', defaultDays)
    }
  }, [defaultDays, form])
  const days = (value) => (value != null ? m.employer_job_auto_status_days({ count: value }) : m.employer_job_auto_status_few_days())

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="automatic-application-status-title">
      <header className="flex gap-3 bg-slate-50 px-4 py-4 sm:px-5">
        <ThunderboltOutlined className="mt-0.5 text-lg text-emerald-600" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="automatic-application-status-title" className="m-0 text-base font-extrabold text-slate-900">
              {m.employer_job_auto_status_title()}
            </h3>
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{m.employer_job_auto_status_new()}</span>
          </div>
          <p className="mb-0 mt-1 text-sm leading-6 text-emerald-700">
            {m.employer_job_auto_status_intro()}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="m-0 min-w-0 flex-1 text-sm leading-6 text-slate-700">
            {m.employer_job_auto_status_rule_before()} <strong>{m.employer_job_auto_status_rule_status()}</strong> {m.employer_job_auto_status_rule_after()}
          </p>
          <Form.Item name="auto_reject_after_days" noStyle>
            <Select
              aria-label={m.employer_job_auto_status_period_aria()}
              className="w-full sm:!w-28"
              disabled={!enabled}
              options={rules?.auto_reject_after_day_choices || []}
              loading={!rules}
            />
          </Form.Item>
          <Form.Item name="auto_reject_stale_applications" valuePropName="checked" noStyle>
            <Switch aria-label={m.employer_job_auto_status_switch_aria()} />
          </Form.Item>
        </div>
        <p className="m-0 text-sm text-slate-500">
          {m.employer_job_auto_status_reminder({ days: days(rules?.auto_rejection_warning_days) })}
        </p>

        <div className="border-t border-slate-200 pt-5">
          <h4 className="m-0 text-sm font-bold text-slate-800">{m.employer_job_auto_status_email_title()}</h4>
          <p className="mb-0 mt-1 text-sm leading-6 text-slate-500">
            {m.employer_job_auto_status_email_hint({ days: days(rules?.auto_rejection_email_grace_days) })}
          </p>
          <Form.Item
            className="!mb-0 !mt-4"
            name="auto_rejection_email_body"
            label={<span className="inline-flex items-center gap-2"><MailOutlined /> {m.employer_job_auto_status_email_body()}</span>}
            dependencies={['auto_reject_stale_applications']}
            rules={[{
              validator(_, value) {
                if (!form.getFieldValue('auto_reject_stale_applications') || value?.trim()) return Promise.resolve()
                return Promise.reject(new Error(m.employer_job_auto_status_email_body_required()))
              },
            }]}
          >
            <Input.TextArea
              aria-label={m.employer_job_auto_status_email_body()}
              autoSize={{ minRows: 6, maxRows: 10 }}
              disabled={!enabled}
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <p className="mb-0 mt-2 text-xs leading-5 text-slate-400">
            {m.employer_job_auto_status_variables({ job_title: '{job_title}', company_name: '{company_name}', auto_reject_weeks: '{auto_reject_weeks}' })}
          </p>
        </div>
      </div>
    </section>
  )
}
