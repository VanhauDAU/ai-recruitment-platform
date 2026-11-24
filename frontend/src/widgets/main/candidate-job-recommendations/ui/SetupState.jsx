import { CompassOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

const SETTINGS_PATH = '/tai-khoan/cai-dat-goi-y-viec-lam'
const MY_CVS_PATH = '/tai-khoan/cv-cua-toi'

function setupCopy({ consentRequired, cvEnabled }) {
  if (consentRequired) return [m.candidate_reco_consent_title(), m.candidate_reco_consent_text()]
  // Gợi ý theo CV bật: thiếu cả CV lẫn nhu cầu mới tới đây, lưu một CV là đủ.
  if (cvEnabled) return [m.candidate_reco_cv_title(), m.candidate_reco_cv_text()]
  return [m.candidate_reco_preferences_title(), m.candidate_reco_preferences_text()]
}

export default function SetupState({ consentRequired = false, cvEnabled = false }) {
  const [title, text] = setupCopy({ consentRequired, cvEnabled })
  return (
    <div className="rounded-2xl border border-dashed border-[var(--brand-primary)]/20 bg-gradient-to-br from-[var(--brand-primary-soft)] to-white px-5 py-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl text-[var(--brand-primary)] shadow-sm">
        {consentRequired ? <InfoCircleOutlined /> : <CompassOutlined />}
      </span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{text}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={SETTINGS_PATH}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)]"
        >
          <SettingOutlined />
          {m.candidate_reco_open_settings()}
        </Link>
        {cvEnabled && !consentRequired && (
          <Link to={MY_CVS_PATH} className="text-sm font-bold text-[var(--brand-primary)] hover:underline">
            {m.candidate_reco_manage_cvs()}
          </Link>
        )}
      </div>
    </div>
  )
}
