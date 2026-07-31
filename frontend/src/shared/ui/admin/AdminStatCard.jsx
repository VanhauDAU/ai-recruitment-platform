export default function AdminStatCard({
  icon,
  label,
  value,
  detail,
  tone = 'blue',
  active = false,
  onClick,
}) {
  const Component = onClick ? 'button' : 'article'
  return (
    <Component
      className={[
        'admin-stat-card',
        onClick && 'admin-stat-card--interactive',
        active && 'admin-stat-card--active',
      ].filter(Boolean).join(' ')}
      {...(onClick ? { onClick, type: 'button' } : {})}
    >
      <div className={`admin-stat-card__icon admin-stat-card__icon--${tone}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="admin-stat-card__label">{label}</p>
        <p className="admin-stat-card__value">{value}</p>
        {detail && <p className="admin-stat-card__detail">{detail}</p>}
      </div>
    </Component>
  )
}
