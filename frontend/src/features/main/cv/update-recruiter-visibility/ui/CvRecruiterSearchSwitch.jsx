import { Switch } from 'antd'
import { useCvRecruiterSearch } from '../model/use-cv-recruiter-search'
import RecruiterConsentModal from './RecruiterConsentModal'

export default function CvRecruiterSearchSwitch({ cv }) {
  const { enabled, busy, setSearchable, consentModalProps } = useCvRecruiterSearch(cv)

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
        <Switch
          aria-label="Cho phép NTD tìm kiếm CV này"
          size="small"
          checked={enabled}
          loading={busy}
          onChange={setSearchable}
          className={enabled ? '!bg-[var(--brand-primary)]' : ''}
        />
        Cho phép NTD tìm kiếm
      </label>
      <RecruiterConsentModal {...consentModalProps} />
    </>
  )
}
