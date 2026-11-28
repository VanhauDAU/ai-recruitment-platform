import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

// Bảng phải khớp kho thật: thêm khóa tùy chọn mới thì thêm cả vào
// OPTIONAL_STORAGE_KEYS (entities/system/consent/lib/consent-storage.js).
function cookieRows() {
  const necessary = m.cookie_policy_group_necessary()
  const preferences = m.cookie_policy_group_preferences()
  const analytics = m.cookie_policy_group_analytics()
  const untilWithdraw = m.cookie_policy_d_until_withdraw()
  return [
    ['procv_consent', m.cookie_policy_mech_signed(), m.cookie_policy_p_consent(), necessary, m.cookie_policy_d_180d()],
    ['procv_consent_v1', 'localStorage', m.cookie_policy_p_consent_mirror(), necessary, m.cookie_policy_d_until_invalid()],
    ['procv_refresh_<portal>', m.cookie_policy_mech_httponly(), m.cookie_policy_p_refresh(), necessary, m.cookie_policy_d_session_expiry()],
    ['procv_auth_logout_<portal>, auth_logout_marker_<portal>', 'Cookie, localStorage', m.cookie_policy_p_logout(), necessary, m.cookie_policy_d_1y()],
    ['procv_oauth_browser', m.cookie_policy_mech_httponly(), m.cookie_policy_p_oauth(), necessary, m.cookie_policy_d_10m()],
    ['procv_lang', 'localStorage', m.cookie_policy_p_lang(), necessary, m.cookie_policy_d_until_lang()],
    ['announcement-strip:*', 'localStorage', m.cookie_policy_p_announcement(), necessary, m.cookie_policy_d_announcement()],
    ['procv:notification-sound, procv:notice-claim:*', 'localStorage', m.cookie_policy_p_sound(), necessary, m.cookie_policy_d_sound()],
    ['job-quality-feedback:*', 'localStorage', m.cookie_policy_p_job_feedback(), necessary, m.cookie_policy_d_until_clear()],
    ['procv.nearby_origin, employer_registration_consent', 'sessionStorage', m.cookie_policy_p_session(), necessary, m.cookie_policy_d_tab_close()],
    ['color-scheme', 'localStorage', m.cookie_policy_p_color(), preferences, untilWithdraw],
    ['search_history', 'localStorage', m.cookie_policy_p_search(), preferences, untilWithdraw],
    ['saved_job_filter', 'localStorage', m.cookie_policy_p_saved_filter(), preferences, untilWithdraw],
    ['procv_job_comparison_v1', 'localStorage', m.cookie_policy_p_compare(), preferences, untilWithdraw],
    ['procv_employer_cv_ordering, procv_admin_*', 'localStorage', m.cookie_policy_p_ui_order(), preferences, untilWithdraw],
    ['procv_viewer_id', m.cookie_policy_mech_signed(), m.cookie_policy_p_viewer(), analytics, m.cookie_policy_d_365d()],
    ['procv_campaign_ref_v1', 'localStorage', m.cookie_policy_p_campaign(), analytics, m.cookie_policy_d_30d()],
    ['_ga, _ga_<id>', 'Cookie (Google)', m.cookie_policy_p_ga(), analytics, m.cookie_policy_d_2y()],
  ]
}

export default function CookiePolicy() {
  const columns = [
    m.cookie_policy_col_name(),
    m.cookie_policy_col_mechanism(),
    m.cookie_policy_col_purpose(),
    m.cookie_policy_col_group(),
    m.cookie_policy_col_duration(),
  ]
  return (
    <div className="bg-slate-50 py-10 sm:py-14">
      <article className="mx-auto max-w-4xl rounded-2xl bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-10 sm:py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--brand-primary)]">ProCV</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{m.cookie_policy_title()}</h1>
        <p className="mt-3 text-sm text-slate-500">{m.cookie_policy_version()}</p>

        <div className="mt-8 space-y-7 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">{m.cookie_policy_what_title()}</h2>
            <p className="mt-2">{m.cookie_policy_what_body()}</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">{m.cookie_policy_table_title()}</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[680px] w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr>{columns.map((label) => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr></thead>
                <tbody>{cookieRows().map((row) => <tr key={row[0]} className="border-t border-slate-200">{row.map((cell, index) => <td key={index} className="px-3 py-3 align-top">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">{m.cookie_policy_third_title()}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><span className="font-semibold">Google reCAPTCHA</span> {m.cookie_policy_third_recaptcha()}</li>
              <li><span className="font-semibold">Google Analytics</span> {m.cookie_policy_third_analytics()}</li>
              <li><span className="font-semibold">YouTube/Vimeo, Google Maps</span> {m.cookie_policy_third_embeds()}</li>
              <li><span className="font-semibold">{m.cookie_policy_third_errors_name()}</span> {m.cookie_policy_third_errors()}</li>
              <li><span className="font-semibold">{m.cookie_policy_third_marketing_name()}</span> {m.cookie_policy_third_marketing()}</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">{m.cookie_policy_views_title()}</h2>
            <p className="mt-2">{m.cookie_policy_views_body()}</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">{m.cookie_policy_change_title()}</h2>
            <p className="mt-2">{m.cookie_policy_change_body()}</p>
          </section>
        </div>
        <Link to="/" className="mt-9 inline-flex font-semibold text-[var(--brand-primary)] hover:underline">{m.cookie_policy_back_home()}</Link>
      </article>
    </div>
  )
}
