import { MASCOT_SCENES } from './mascot-assets'
import './mascot.css'

export default function MascotEmpty({ children, className = '', description, scene, size = 160 }) {
  const source = MASCOT_SCENES[scene] || scene || MASCOT_SCENES.emptyStateJobs

  return (
    <div className={`procv-mascot-empty ${className}`}>
      <img
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="lazy"
        src={source}
        className="procv-mascot-empty__image"
        style={{ '--procv-empty-size': `${size}px`, '--procv-empty-size-large': `${Math.round(size * 1.25)}px` }}
      />
      {description && <div className="procv-mascot-empty__description">{description}</div>}
      {children && <div className="procv-mascot-empty__actions">{children}</div>}
    </div>
  )
}
