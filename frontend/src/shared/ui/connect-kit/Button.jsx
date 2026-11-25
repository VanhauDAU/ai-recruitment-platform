/**
 * Quiet text button of ProCV Connect. Variants: accent, ink, muted, danger
 * (text only), primary (solid, dialog confirm only), quiet (mist fill, block).
 * Styles live in the lazy connect.css of the Connect pages.
 */
export default function Button({ variant = 'ink', loading = false, disabled = false, block = false, className = '', type = 'button', children, ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`pc-btn pc-btn--${variant}${block ? ' pc-btn--block' : ''}${loading ? ' pc-btn--loading' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

/** Square icon button (composer, header); `label` is the accessible name. */
export function IconButton({ label, className = '', type = 'button', children, ...props }) {
  return (
    <button type={type} aria-label={label} title={label} className={`pc-icon-btn ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

/** Small rounded action ("Nhắn tin"); `current` renders the filled, inactive state. */
export function Pill({ current = false, loading = false, className = '', children, ...props }) {
  if (current) return <span className={`pc-pill pc-pill--current ${className}`.trim()}>{children}</span>
  return (
    <button type="button" disabled={loading} aria-busy={loading || undefined} className={`pc-pill ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
