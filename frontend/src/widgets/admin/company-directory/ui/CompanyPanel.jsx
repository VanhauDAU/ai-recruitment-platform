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
