/** Static placeholder bars (no shimmer); `avatar` adds a round block on the left. */
export default function Skeleton({ rows = 2, avatar = false, className = '' }) {
  return (
    <div className={`pc-skeleton ${className}`.trim()} aria-hidden>
      {avatar && <span className="pc-skeleton__avatar" />}
      <span className="pc-skeleton__lines">
        {Array.from({ length: rows }, (_, index) => <span key={index} className="pc-skeleton__bar" />)}
      </span>
    </div>
  )
}
