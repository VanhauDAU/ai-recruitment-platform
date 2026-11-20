import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  FileProtectOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Modal, Progress } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '@/entities/account/session'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
} from '@/shared/config/portals'
import { getEmployerVerificationProgress } from '../model/verification-progress'
import EmployerVerificationLifecycleAlert from './EmployerVerificationLifecycleAlert'
import { m } from '@/shared/config/i18n'

const STEP_DEFINITIONS = [
  { key: 'phone_verified', title: m.employer_account_checklist_phone_title, actionLabel: m.employer_account_checklist_phone_action(), description: m.employer_account_checklist_phone_desc(), icon: PhoneOutlined, to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', title: m.employer_account_checklist_company_title, actionLabel: m.employer_account_checklist_company_title(), description: m.employer_account_checklist_company_desc(), icon: BankOutlined, to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_current', title: m.employer_account_checklist_business_title, actionLabel: m.employer_account_checklist_business_action(), description: m.employer_account_checklist_business_desc(), icon: FileProtectOutlined, to: EMPLOYER_BUSINESS_LICENSE_URL },
  { key: 'candidate_dpa_submitted', title: m.employer_account_checklist_candidate_dpa_title, actionLabel: m.employer_account_checklist_candidate_dpa_action(), description: m.employer_account_checklist_candidate_dpa_desc(), icon: FileProtectOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'dpa_accepted', title: m.employer_account_checklist_dpa_title, actionLabel: m.employer_account_checklist_dpa_action(), description: m.employer_account_checklist_dpa_desc(), icon: SafetyCertificateOutlined, to: EMPLOYER_DATA_PROTECTION_URL },
]

export default function EmployerVerificationChecklist({ profile, onContinue }) {
  const { user } = useSession()
  const { settings, siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false)
  const verification = profile?.onboarding || {}
  const progress = getEmployerVerificationProgress(verification)
  const hotline = settingText(settings.hotline, DEFAULT_SITE_SETTINGS.hotline)
  const supportEmail = settingText(settings.support_email, DEFAULT_SITE_SETTINGS.support_email)

  function openStep(step) {
    if (step.key === 'phone_verified' && !user?.has_usable_password) {
      setPasswordPromptOpen(true)
      return
    }
    if (step.to) navigate(step.to)
  }

  function stepAction(step) {
    if (verification[step.key]) return <span className="text-xs font-bold text-emerald-600">{m.employer_account_checklist_done()}</span>
    return <Button type="text" aria-label={step.actionLabel} icon={<ArrowRightOutlined />} onClick={() => openStep(step)} />
  }

  return (
    <div>
      <EmployerVerificationLifecycleAlert
        className="mb-6"
        verificationCase={profile?.verification_case}
      />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{m.employer_account_checklist_title()}</h2>
          <p className="mt-1 text-sm text-slate-500">{m.employer_account_checklist_subtitle()}</p>
        </div>
        <strong className="text-sm text-emerald-600">{m.employer_account_checklist_progress({ percent: progress.percent })}</strong>
      </div>
      <Progress percent={progress.percent} showInfo={false} strokeColor="#00b14f" railColor="#e8edf2" className="!mb-6" />

      <div className="divide-y divide-slate-100">
        {STEP_DEFINITIONS.map((step) => {
          const Icon = step.icon
          const done = Boolean(verification[step.key])
          return (
            <div key={step.key} className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {done ? <CheckCircleFilled className="text-xl" /> : <Icon className="text-lg" />}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-bold ${done ? 'text-slate-600' : 'text-slate-900'}`}>{step.title({ siteName })}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
              </div>
              <div className="shrink-0">{stepAction(step)}</div>
            </div>
          )
        })}
      </div>

      <Button type="link" onClick={onContinue} className="!mt-6 !w-full !text-slate-500">
        {m.employer_account_checklist_later()}
      </Button>

      <Modal
        open={passwordPromptOpen}
        onCancel={() => setPasswordPromptOpen(false)}
        footer={null}
        title={m.employer_account_checklist_prompt_title()}
      >
        <div className="space-y-4 text-sm leading-6 text-slate-600">
          <p>{m.employer_account_checklist_prompt_1()}</p>
          <p>{m.employer_account_checklist_prompt_2()}</p>
          <Button type="primary" block size="large" onClick={() => navigate(EMPLOYER_PASSWORD_SETTINGS_URL)}>
            {m.employer_account_checklist_prompt_button()}
          </Button>
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5">
            {m.employer_account_checklist_support_intro()}<br />
            {m.employer_account_checklist_support_hotline()} <a href={`tel:${hotline.replace(/[^+\d]/g, '')}`} className="font-bold text-emerald-700">{hotline}</a><br />
            Email: <a href={`mailto:${supportEmail}`} className="font-bold text-emerald-700">{supportEmail}</a>
          </div>
        </div>
      </Modal>
    </div>
  )
}
