/** Status as text with a 6px dot; tone: fog, accent, slate or danger. */
export default function StatusText({ tone = 'fog', children, className = '' }) {
  return <span className={`pc-status pc-status--${tone} ${className}`.trim()}>{children}</span>
}
