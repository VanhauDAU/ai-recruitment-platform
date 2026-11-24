import { Checkbox, Form } from 'antd'
import { Link } from 'react-router'
import { useSiteSettings } from '@/entities/system/site-settings'
import { employerMarketingPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

export default function EmployerConsentFields({ compact = false }) {
  const { siteName } = useSiteSettings()
  return (
    <div className={compact ? 'space-y-3' : 'space-y-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] p-4'}>
      {!compact && (
        <p className="text-sm leading-6 text-slate-600">
          {m.employer_account_consent_intro({ siteName })}
        </p>
      )}
      <Form.Item
        name="terms_accepted"
        valuePropName="checked"
        required
        className="!mb-0"
        rules={[{
          validator: (_, value) => value
            ? Promise.resolve()
            : Promise.reject(new Error(m.employer_account_consent_required())),
        }]}
      >
        <Checkbox className="!items-start">
          <span className="text-sm leading-6 text-slate-700">
            {m.employer_account_consent_terms_before()}{' '}
            <Link target="_blank" to={employerMarketingPath('/dieu-khoan-dich-vu')} className="font-semibold !text-[var(--brand-primary-hover)] hover:underline">{m.employer_account_consent_terms_link()}</Link>
            {' '}{m.employer_account_consent_and()}{' '}
            <Link target="_blank" to={employerMarketingPath('/chinh-sach-quyen-rieng')} className="font-semibold !text-[var(--brand-primary-hover)] hover:underline">{m.employer_account_consent_privacy_link()}</Link>.
            <span className="ml-1 text-red-500" aria-hidden="true">*</span>
          </span>
        </Checkbox>
      </Form.Item>
      <Form.Item name="marketing_opt_in" valuePropName="checked" className="!mb-0">
        <Checkbox className="!items-start">
          <span className="text-sm leading-6 text-slate-600">
            {m.employer_account_consent_marketing()}
          </span>
        </Checkbox>
      </Form.Item>
    </div>
  )
}
