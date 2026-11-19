import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import { getEmployerPasswordRequirements, getPasswordRequirements } from './password-validation'
import { m } from '@/shared/config/i18n'

function EmployerPasswordRequirements({ password }) {
  const requirements = getEmployerPasswordRequirements(password)
  const items = [
    { key: 'length', label: m.account_auth_req_min_length() },
    { key: 'letterCase', label: m.account_password_check_case() },
    { key: 'number', label: m.account_password_check_digit() },
    { key: 'specialCharacter', label: m.account_auth_req_special() },
  ]
  const passed = items.filter(({ key }) => requirements[key]).length
  const isStrong = passed === items.length
  const isMedium = !isStrong && passed >= 2
  const status = isStrong ? m.account_auth_req_strong() : isMedium ? m.account_auth_req_medium() : m.account_auth_req_weak()
  const color = isStrong ? 'bg-emerald-500' : isMedium ? 'bg-amber-400' : 'bg-red-500'
  const statusColor = isStrong ? 'text-emerald-600' : isMedium ? 'text-amber-600' : 'text-red-600'

  return (
    <section
      aria-label={m.account_auth_req_aria()}
      aria-live="polite"
      className="mb-3 mt-[-0.35rem] rounded-xl border border-slate-100 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,.08)]"
    >
      <div className={`flex items-center gap-2 text-sm font-bold ${statusColor}`}>
        <ExclamationCircleFilled aria-hidden="true" />
        <span>{status}</span>
      </div>
      <div className="mt-2 flex gap-2" aria-label={m.account_password_strength_aria({ passed, total: items.length })}>
        {items.map(({ key }, index) => <span key={key} className={`h-1 flex-1 rounded-full ${index < passed ? color : 'bg-slate-200'}`} />)}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        {items.map(({ key, label }) => {
          const valid = requirements[key]
          return (
            <li key={key} className={`flex items-center gap-2 transition-colors ${valid ? 'text-emerald-600' : ''}`}>
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full border ${valid ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />
              <span>{label}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function PasswordRequirements({ password, mode = 'default' }) {
  if (!password) return null

  if (mode === 'employer') return <EmployerPasswordRequirements password={password} />

  const requirements = getPasswordRequirements(password)
  const items = [
    { key: 'length', label: m.account_auth_req_length() },
    { key: 'composition', label: m.account_auth_req_composition() },
  ]

  return (
    <ul
      aria-label={m.account_auth_req_aria()}
      className="mb-3 mt-[-0.35rem] space-y-1 rounded-xl bg-gray-50 px-3 py-2 text-xs dark:bg-zinc-900"
    >
      {items.map(({ key, label }) => (
        <li
          key={key}
          className={`flex items-center gap-2 transition-colors ${
            requirements[key] ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {requirements[key] ? (
            <CheckCircleFilled aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
