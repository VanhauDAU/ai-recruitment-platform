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
  tone = 'default',
  hint,
  active = false,
  onClick,
}) {
  const className = [
    'admin-stat-card',
    `admin-stat-card--${tone}`,
    onClick ? 'admin-stat-card--interactive' : '',
    active ? 'admin-stat-card--active' : '',
  ].filter(Boolean).join(' ')
  const content = (
    <>
      <span className="admin-stat-card__icon" aria-hidden="true">{icon}</span>
      <div className="admin-stat-card__content">
        <div className="admin-stat-card__header">
          <span className="admin-stat-card__label">{label}</span>
          <strong className="admin-stat-card__value">{value ?? 0}</strong>
        </div>
        {hint && <span className="admin-stat-card__hint">{hint}</span>}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`${label}: ${value ?? 0}${hint ? `. ${hint}` : ''}`}
        className={className}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <article className={className}>
      {content}
    </article>
  )
}
