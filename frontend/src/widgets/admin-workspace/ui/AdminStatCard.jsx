export default function AdminStatCard({
  icon,
  label,
  value,
  detail,
  tone = 'blue',
}) {
  return (
    <article className="admin-stat-card">
      <div className={`admin-stat-card__icon admin-stat-card__icon--${tone}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="admin-stat-card__label">{label}</p>
        <p className="admin-stat-card__value">{value}</p>
        {detail && <p className="admin-stat-card__detail">{detail}</p>}
      </div>
    </article>
  )
}
