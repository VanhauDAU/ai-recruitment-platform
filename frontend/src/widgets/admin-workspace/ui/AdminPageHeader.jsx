export default function AdminPageHeader({
  eyebrow = 'Trung tâm quản trị',
  title,
  description,
  icon,
  actions,
}) {
  return (
    <header className="admin-page-header">
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <span className="admin-page-header__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="admin-page-header__eyebrow">{eyebrow}</p>
          <h1 className="admin-page-header__title">{title}</h1>
          {description && (
            <p className="admin-page-header__description">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </header>
  )
}
