import { DownOutlined } from '@ant-design/icons'

export default function AdminJobDisclosure({
  sectionKey,
  title,
  description,
  icon,
  badge,
  open,
  onToggle,
  children,
  compact = false,
}) {
  const contentId = `admin-job-section-${sectionKey}`
  return (
    <section
      className={`admin-panel admin-job-disclosure ${open ? 'admin-job-disclosure--open' : ''}`}
      id={`admin-job-${sectionKey}`}
    >
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="admin-job-disclosure__trigger"
        onClick={() => onToggle(sectionKey)}
        type="button"
      >
        <span className="admin-job-disclosure__icon" aria-hidden="true">{icon}</span>
        <span className="admin-job-disclosure__heading">
          <span className="admin-job-disclosure__title">{title}</span>
          <span className="admin-job-disclosure__description">{description}</span>
        </span>
        {badge && <span className="admin-job-disclosure__badge">{badge}</span>}
        <DownOutlined className="admin-job-disclosure__chevron" />
      </button>
      {open && (
        <div
          className={`admin-job-disclosure__body ${compact ? 'admin-job-disclosure__body--compact' : ''}`}
          id={contentId}
        >
          {children}
        </div>
      )}
    </section>
  )
}

