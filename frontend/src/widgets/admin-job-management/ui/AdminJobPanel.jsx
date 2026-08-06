export default function AdminJobPanel({ title, description, icon, badge, children }) {
  return (
    <section className="admin-panel admin-job-panel">
      <header className="admin-job-panel__header">
        <span aria-hidden="true" className="admin-job-panel__icon">{icon}</span>
        <span className="admin-job-panel__heading">
          <h2>{title}</h2>
          <small>{description}</small>
        </span>
        {badge && <span className="admin-job-panel__badge">{badge}</span>}
      </header>
      <div className="admin-job-panel__body">{children}</div>
    </section>
  )
}
