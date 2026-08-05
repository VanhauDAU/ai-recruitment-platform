const METRIC_TONES = {
  slate: {
    icon: 'bg-slate-100 text-slate-700',
    value: 'text-slate-900',
    glow: 'from-slate-100',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-600',
    value: 'text-sky-700',
    glow: 'from-sky-100',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-700',
    glow: 'from-amber-100',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-emerald-700',
    glow: 'from-emerald-100',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600',
    value: 'text-violet-700',
    glow: 'from-violet-100',
  },
}

export function CampaignMetric({ icon: Icon, label, value, hint, tone = 'slate' }) {
  const colors = METRIC_TONES[tone]
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <span className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${colors.glow} to-transparent opacity-80`} />
      <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-base ${colors.icon}`}>
        <Icon aria-hidden />
      </span>
      <p className="relative mt-4 min-h-9 text-xs font-semibold leading-4 text-slate-500">{label}</p>
      <strong className={`relative mt-1 block text-2xl font-bold tracking-tight ${colors.value}`}>
        {value}
      </strong>
      <span className="relative mt-1.5 block min-h-4 text-xs leading-4 text-slate-400">{hint}</span>
    </article>
  )
}

export function CampaignSectionTitle({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
