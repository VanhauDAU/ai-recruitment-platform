export function CompanyPanel({
  title,
  description,
  children,
  className = '',
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {(title || description) && (
        <div className="admin-panel__header">
          <div className="min-w-0">
            {title && <h2 className="admin-panel__title">{title}</h2>}
            {description && <p className="admin-panel__description">{description}</p>}
          </div>
        </div>
      )}
      <div className="admin-panel__body">{children}</div>
    </section>
  )
}

export function CompanyStatCard({
  icon,
  label,
  value,
  tone = 'primary',
}) {
  return (
    <article className={`admin-stat-card admin-stat-card--${tone}`}>
      <span className="admin-stat-card__icon" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="admin-stat-card__label">{label}</span>
        <strong className="admin-stat-card__value">{value}</strong>
      </span>
    </article>
  )
}
