// Chỉ số trong một dải chung (khung ở .cw-metrics); màu chỉ dùng cho con số.
export function CampaignMetric({ icon: Icon, label, value, hint, tone = 'slate' }) {
  return (
    <article className={`cw-metric is-${tone}`}>
      <p className="cw-metric__label"><Icon aria-hidden /> {label}</p>
      <strong className="cw-metric__value">{value}</strong>
      {hint && <span className="cw-metric__hint">{hint}</span>}
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
