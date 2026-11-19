/** Admin surface for one block of the account detail: title, optional note and action. */
export default function DetailPanel({ title, description, extra, className = '', children }) {
  return (
    <section className={`admin-panel account-detail-panel ${className}`}>
      {(title || extra) && (
        <header className="admin-panel__header">
          <div className="min-w-0">
            {title && <h2 className="admin-panel__title">{title}</h2>}
            {description && <p className="admin-panel__description">{description}</p>}
          </div>
          {extra && <div className="admin-panel__extra">{extra}</div>}
        </header>
      )}
      <div className="admin-panel__body">{children}</div>
    </section>
  )
}
