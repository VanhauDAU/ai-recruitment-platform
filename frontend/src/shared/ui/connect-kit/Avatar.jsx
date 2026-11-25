import { avatarInitial } from './avatar-initial'

/** Round avatar: the picture when there is one, otherwise the initial. */
export default function Avatar({ src, name = '', size = 40, className = '' }) {
  return (
    <span className={`pc-avatar ${className}`.trim()} style={{ '--pc-avatar-size': `${size}px` }} aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : avatarInitial(name)}
    </span>
  )
}
