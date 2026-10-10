export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  meta,
  className = '',
}) {
  return (
    <header className={`admin-page-header ${className}`.trim()}>
      <div className="admin-page-header__content">
        {icon && (
          <span className="admin-page-header__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="admin-page-header__eyebrow">{eyebrow}</p>}
          <h1 className="admin-page-header__title">{title}</h1>
          {description && <p className="admin-page-header__description">{description}</p>}
          {meta && <div className="admin-page-header__meta">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div className="admin-page-header__actions" data-print-hide="true">
          {actions}
        </div>
      )}
    </header>
  )
}
