import { Link } from 'react-router'
import { ACCOUNT_ROOT } from '@/entities/account/account'
import { ConnectionInvitationList } from '@/features/main/application/respond-to-connection-invitation'
import { m } from '@/shared/config/i18n'

export default function EmployerConnections() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-b from-[var(--brand-primary-soft)] to-white px-5 pt-6 pb-2 sm:px-6">
        <h1 className="text-xl font-bold text-[var(--brand-primary)] sm:text-2xl">{m.candidate_connections_title()}</h1>
        <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
          <p>
            {m.candidate_connections_intro_before()}{' '}
            <strong className="text-slate-800">{m.candidate_connections_accept()}</strong>{' '}
            {m.candidate_connections_intro_after()}
          </p>
          <p>
            {m.candidate_connections_decline_hint_before()}{' '}
            <strong className="text-slate-800">{m.candidate_connections_decline()}</strong>
            {m.candidate_connections_decline_hint_after()}
          </p>
        </div>
      </header>

      <ConnectionInvitationList />

      <footer className="mx-5 border-t border-slate-200 py-5 text-sm text-slate-600 sm:mx-6">
        {m.candidate_connections_footer()}{' '}
        <Link to={`${ACCOUNT_ROOT}/cv-cua-toi`} className="font-semibold !text-[var(--brand-primary)] hover:underline">
          {m.candidate_connections_footer_link()}
        </Link>
      </footer>
    </section>
  )
}
