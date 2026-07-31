export default function AdminPanel({
  title,
  description,
  extra,
  children,
  className = '',
  padded = true,
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {(title || description || extra) && (
        <div className="admin-panel__header">
          <div className="min-w-0">
            {title && <h2 className="admin-panel__title">{title}</h2>}
            {description && <p className="admin-panel__description">{description}</p>}
          </div>
          {extra && <div className="admin-panel__extra">{extra}</div>}
        </div>
      )}
      <div className={padded ? 'admin-panel__body' : ''}>{children}</div>
    </section>
  )
}
