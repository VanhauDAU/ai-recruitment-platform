import { ArrowRightOutlined, CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, ThunderboltFilled } from '@ant-design/icons'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

// Huy hiệu Sấm Chớp (ADR-0027): hệ thống tự cấp khi NTD trả lời hồ sơ đúng hạn, đều đặn.
function criterionText(item, badge) {
  switch (item.code) {
    case 'enough_applications':
      return m.employer_workspace_dash_flash_enough({ value: item.value, target: item.target, days: badge.window_days })
    case 'response_rate':
      return m.employer_workspace_dash_flash_rate({ value: item.value ?? 0, target: item.target, hours: badge.response_hours })
    case 'recent_activity':
      return m.employer_workspace_dash_flash_recent({ days: item.target })
    default:
      return item.met
        ? m.employer_workspace_dash_flash_no_overdue()
        : m.employer_workspace_dash_flash_overdue({ count: item.value })
  }
}

export default function FlashBadgeProgressCard({ badge }) {
  if (!badge?.enabled) return null
  const needsReply = badge.overdue_count > 0 || badge.at_risk_count > 0

  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-24px_rgba(15,23,42,.45)]" aria-labelledby="flash-badge-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badge.qualified ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
            <ThunderboltFilled />
          </span>
          <div>
            <h2 id="flash-badge-title" className="text-base font-black text-slate-900">{m.employer_workspace_dash_flash_title()}</h2>
            <p className="text-xs text-slate-500">{m.employer_workspace_dash_flash_description()}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.qualified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {badge.qualified ? m.employer_workspace_dash_flash_earned() : m.employer_workspace_dash_flash_not_earned()}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {badge.criteria.map((item) => (
          <li key={item.code} data-criterion={item.code} className="flex items-start gap-2 text-sm text-slate-700">
            {item.met
              ? <CheckCircleFilled className="mt-0.5 text-emerald-500" aria-label={m.employer_workspace_dash_flash_met()} />
              : <CloseCircleFilled className="mt-0.5 text-slate-300" aria-label={m.employer_workspace_dash_flash_unmet()} />}
            <span>{criterionText(item, badge)}</span>
          </li>
        ))}
      </ul>

      {badge.at_risk_count > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <ClockCircleFilled aria-hidden="true" />
          {m.employer_workspace_dash_flash_at_risk({ count: badge.at_risk_count })}
        </p>
      )}

      {needsReply && (
        <Link to={employerAppPath('/applications')} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold !text-[var(--brand-primary)]">
          {m.employer_workspace_dash_flash_reply()} <ArrowRightOutlined className="text-xs" />
        </Link>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{m.employer_workspace_dash_flash_hourly()}</p>
    </section>
  )
}
